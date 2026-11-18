import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { USERS } from './credentials'
import { apiAs, apiWallets, exactLabel, expectFieldError, signIn, signOut, signUp } from './account-helpers'

/**
 * Carteiras (docs/SPEC.md, "Conta e sessão" e seção 9). Usuário novo criado em /signup nos casos
 * 18 a 21; Ana e Bruno do seed no isolamento (22).
 */

test.describe.configure({ timeout: 60_000 })

const PRIMARY = {
  displayName: 'Novo Colecionador',
  nickname: 'Minha principal',
  network: 'ethereum',
  profileName: 'Perfil Novo',
  address: '0x' + 'a'.repeat(40),
  walletType: 'MetaMask',
  referralCode: 'NOVO-2026',
  email: 'novo.colecionador@example.com',
  ens: 'novo-colecionador',
}
const SECONDARY = {
  ...PRIMARY,
  nickname: 'Minha reserva',
  network: 'polygon',
  address: '0x' + 'b'.repeat(40),
  walletType: 'WalletConnect',
  referralCode: 'RESERVA-2026',
}
const OTHER_ADDRESS = '0x' + 'c'.repeat(40)

const primarySection = (page: Page) => page.getByRole('region', { name: 'Carteira principal' })
const secondarySection = (page: Page) => page.getByRole('region', { name: 'Carteira secundária' })
const secondaryDialog = (page: Page) => page.getByRole('dialog', { name: /carteira secundária/ })
const toast = (page: Page, text: string) => page.locator('[aria-live]').getByText(text)
const addressField = (scope: Locator) => scope.getByLabel(exactLabel('Endereço da carteira'))

async function fillWallet(scope: Locator, v: typeof PRIMARY) {
  await scope.getByLabel(exactLabel('Nome de exibição')).fill(v.displayName)
  await scope.getByLabel(exactLabel('Apelido da carteira')).fill(v.nickname)
  await scope.getByLabel(exactLabel('Rede')).selectOption(v.network)
  await scope.getByLabel(exactLabel('Nome do perfil')).fill(v.profileName)
  await addressField(scope).fill(v.address)
  await scope.getByLabel(exactLabel('Tipo de carteira')).selectOption(v.walletType)
  await scope.getByLabel(exactLabel('Código de indicação')).fill(v.referralCode)
  await scope.getByLabel(exactLabel('E-mail')).fill(v.email)
  await scope.getByLabel(exactLabel('Nome ENS')).fill(v.ens)
}

async function savePrimary(page: Page, values = PRIMARY) {
  await fillWallet(primarySection(page), values)
  await primarySection(page).getByRole('button', { name: 'Salvar carteira' }).click()
  await expect(toast(page, 'Carteira principal cadastrada')).toBeVisible()
}

async function saveSecondary(page: Page, values = SECONDARY) {
  await secondarySection(page).getByRole('button', { name: 'Adicionar' }).click()
  const dialog = secondaryDialog(page)
  await expect(dialog).toBeVisible()
  await fillWallet(dialog, values)
  await dialog.getByRole('button', { name: 'Salvar carteira' }).click()
  await expect(toast(page, 'Carteira secundária cadastrada')).toBeVisible()
  await expect(dialog).toBeHidden()
}

async function newUserOnWallets(page: Page) {
  await signUp(page)
  await page.goto('/wallets')
  await expect(primarySection(page)).toBeVisible()
}

test('18. usuário novo: principal vazia e secundária vazia; cadastra as duas e persiste após F5', async ({ page }) => {
  await newUserOnWallets(page)

  // Estado vazio.
  for (const label of ['Nome de exibição', 'Apelido da carteira', 'Nome do perfil', 'Endereço da carteira', 'Código de indicação']) {
    await expect(primarySection(page).getByLabel(exactLabel(label))).toHaveValue('')
  }
  await expect(secondarySection(page).getByText(/Você ainda não adicionou uma carteira secundária/)).toBeVisible()
  await expect(secondarySection(page).getByRole('button', { name: 'Adicionar' })).toBeDisabled() // exige a principal

  await savePrimary(page)
  await saveSecondary(page)
  await expect(secondarySection(page).getByText(SECONDARY.address)).toBeVisible()
  await expect(secondarySection(page).getByText(SECONDARY.nickname)).toBeVisible()

  await page.reload()
  await expect(addressField(primarySection(page))).toHaveValue(PRIMARY.address)
  await expect(primarySection(page).getByLabel(exactLabel('Apelido da carteira'))).toHaveValue(PRIMARY.nickname)
  await expect(secondarySection(page).getByText(SECONDARY.address)).toBeVisible()
  await expect(secondarySection(page).getByText(SECONDARY.nickname)).toBeVisible()
  expect((await apiWallets(page)).map((w) => [w.role, w.address])).toEqual([
    ['primary', PRIMARY.address],
    ['secondary', SECONDARY.address],
  ])
})

test('19. validação: endereço inválido com foco no campo; secundária igual à principal é recusada', async ({ page }) => {
  await newUserOnWallets(page)

  const address = addressField(primarySection(page))
  await fillWallet(primarySection(page), { ...PRIMARY, address: '0x123abc' })
  await primarySection(page).getByRole('button', { name: 'Salvar carteira' }).click()
  await expectFieldError(address, /Endereço deve ter 0x/)
  await expect(address).toBeFocused()
  expect(await apiWallets(page)).toHaveLength(0)

  await address.fill(PRIMARY.address)
  await primarySection(page).getByRole('button', { name: 'Salvar carteira' }).click()
  await expect(toast(page, 'Carteira principal cadastrada')).toBeVisible()

  await secondarySection(page).getByRole('button', { name: 'Adicionar' }).click()
  const dialog = secondaryDialog(page)
  await fillWallet(dialog, { ...SECONDARY, address: PRIMARY.address })
  await dialog.getByRole('button', { name: 'Salvar carteira' }).click()
  await expectFieldError(addressField(dialog), 'Endereço já cadastrado')
  await expect(dialog).toBeVisible()
  expect(await apiWallets(page)).toHaveLength(1)
})

test('20. "Igual à carteira principal": copia os dados com aviso, recusa o mesmo endereço e salva com outro', async ({
  page,
}) => {
  await newUserOnWallets(page)
  await savePrimary(page)

  // Pelo rótulo: abre o diálogo com os dados copiados e o aviso.
  await secondarySection(page).getByLabel('Igual à carteira principal').click()
  const dialog = secondaryDialog(page)
  await expect(dialog).toBeVisible()
  await expect(addressField(dialog)).toHaveValue(PRIMARY.address)
  await expect(dialog.getByLabel(exactLabel('Apelido da carteira'))).toHaveValue(PRIMARY.nickname)
  await expect(dialog.getByText(/Dados copiados da carteira principal/)).toBeVisible()

  // Sem trocar o endereço: recusado.
  await dialog.getByRole('button', { name: 'Salvar carteira' }).click()
  await expectFieldError(addressField(dialog), 'Endereço já cadastrado')
  expect(await apiWallets(page)).toHaveLength(1)

  // Com outro endereço: salva e persiste.
  await addressField(dialog).fill(OTHER_ADDRESS)
  await dialog.getByLabel(exactLabel('Apelido da carteira')).fill('Cópia ajustada')
  await dialog.getByRole('button', { name: 'Salvar carteira' }).click()
  await expect(toast(page, 'Carteira secundária cadastrada')).toBeVisible()
  await expect(dialog).toBeHidden()

  await page.reload()
  await expect(secondarySection(page).getByText(OTHER_ADDRESS)).toBeVisible()
  await expect(secondarySection(page).getByText('Cópia ajustada')).toBeVisible()
  await expect(addressField(primarySection(page))).toHaveValue(PRIMARY.address)
})

test('21. a carteira nova aparece na lista de carteiras do /checkout', async ({ page }) => {
  await newUserOnWallets(page)
  await savePrimary(page)
  await saveSecondary(page)

  // Um item no carrinho para abrir o checkout (pela API, como o app faria).
  const nft = (await apiAs<{ editions: { id: string; available: number }[] }>(page, 'GET', '/nfts/nft_002')).body
  const edition = nft.editions.find((e) => e.available > 0)!
  const added = await apiAs(page, 'POST', '/cart/items', { nftId: 'nft_002', editionId: edition.id, quantity: 1 })
  expect(added.status).toBe(201)

  await page.goto('/checkout')
  const list = page.getByRole('radiogroup', { name: 'Carteira conectada' })
  await expect(list.getByRole('radio', { name: new RegExp(PRIMARY.nickname) })).toBeVisible()
  await expect(list.getByRole('radio', { name: new RegExp(SECONDARY.nickname) })).toBeVisible()
})

test('22. isolamento: as carteiras da Ana não aparecem para o Bruno', async ({ page, isMobile }) => {
  await signIn(page, 'ana', '/wallets')
  await expect(secondarySection(page).getByText('Reserva')).toBeVisible()
  const anaWallets = await apiWallets(page)
  expect(anaWallets.length).toBeGreaterThan(0)
  await signOut(page, isMobile)

  await signIn(page, 'bruno', '/wallets')
  await expect(secondarySection(page).getByText('Sem saldo')).toBeVisible()
  await expect(page.getByText('Reserva')).toHaveCount(0)
  const content = await page.getByRole('main').evaluate((main) => {
    const values = Array.from(main.querySelectorAll('input')).map((input) => input.value)
    return `${main.textContent}\n${values.join('\n')}`
  })
  for (const wallet of anaWallets) {
    expect(content).not.toContain(wallet.address)
    expect(content).not.toContain(wallet.email)
  }
  expect(content).not.toContain(USERS.ana.name)
  const brunoWallets = await apiWallets(page)
  expect(brunoWallets.map((w) => w.address)).not.toEqual(expect.arrayContaining(anaWallets.map((w) => w.address)))
})
