import type { Page } from '@playwright/test'
import { expect, setLatency, test } from './fixtures'
import { USERS } from './credentials'
import {
  appStorage,
  countRequests,
  exactLabel,
  expectFieldError,
  goToAccountSection,
  queryCache,
  signIn,
  signOut,
  submitLoginForm,
} from './account-helpers'

/**
 * Perfil, avatar e senha da Ana (docs/SPEC.md, "Conta e sessão" e seção 9). No mobile, o menu
 * "Meu perfil" aparece como abas no topo (usadas em goToAccountSection).
 */

test.describe.configure({ timeout: 60_000 })

const ANA = USERS.ana
const BRUNO = USERS.bruno

const field = (page: Page, label: string) => page.getByLabel(exactLabel(label))
const save = (page: Page) => page.getByRole('button', { name: 'Salvar', exact: true })
const toast = (page: Page, text: string) => page.locator('[aria-live]').getByText(text)

async function openAnaProfile(page: Page) {
  await signIn(page, 'ana', '/profile')
  await expect(field(page, 'Nome de exibição')).toHaveValue(ANA.name)
}

/** 1x1 PNG válido, gerado em memória. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)
const fileInput = (page: Page) => page.locator('input[type="file"]')

test('13. nome de exibição: toast, header na hora e valor após F5; Salvar desabilitado sem mudança', async ({
  page,
  isMobile,
}) => {
  await openAnaProfile(page)
  await expect(save(page)).toBeDisabled()

  await field(page, 'Nome de exibição').fill('Ana Souza Silva')
  await expect(save(page)).toBeEnabled()
  await save(page).click()

  await expect(toast(page, 'Perfil atualizado com sucesso')).toBeVisible()
  if (!isMobile) {
    // O mobile não tem header com o nome; no desktop ele muda sem recarregar.
    await expect(page.getByRole('button', { name: 'Menu da conta de Ana Souza Silva' })).toBeVisible()
  }
  await expect(save(page)).toBeDisabled()

  await page.reload()
  await expect(field(page, 'Nome de exibição')).toHaveValue('Ana Souza Silva')
  if (!isMobile) {
    await expect(page.getByRole('button', { name: 'Menu da conta de Ana Souza Silva' })).toBeVisible()
  }
})

test('14. conflito no perfil: e-mail e nome de usuário do Bruno erram no campo certo e nada muda', async ({
  page,
}) => {
  await openAnaProfile(page)

  await field(page, 'E-mail').fill(BRUNO.email)
  await save(page).click()
  await expectFieldError(field(page, 'E-mail'), 'E-mail já cadastrado')
  await page.reload()
  await expect(field(page, 'E-mail')).toHaveValue(ANA.email)

  await field(page, 'Nome de usuário').fill('Bruno_Lima')
  await save(page).click()
  await expectFieldError(field(page, 'Nome de usuário'), 'Nome de usuário já em uso')
  await page.reload()
  await expect(field(page, 'Nome de usuário')).toHaveValue('ana_souza')
  await expect(field(page, 'E-mail')).toHaveValue(ANA.email)
})

test('15a. avatar: arquivo inválido (.txt e acima de 2 MB) mostra a mensagem de erro', async ({ page }) => {
  await openAnaProfile(page)
  const upload = countRequests(page, 'PUT', '/profile/avatar')

  await fileInput(page).setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('oi') })
  await expect(page.getByRole('alert').filter({ hasText: 'Formato não aceito' })).toBeVisible()

  await fileInput(page).setInputFiles({
    name: 'grande.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
  })
  await expect(page.getByRole('alert').filter({ hasText: 'A imagem deve ter até 2 MB.' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Avatar padrão' })).toBeVisible()
  expect(upload.count, 'arquivo inválido não vai para a rede').toBe(0)
})

test('15b. avatar: PNG válido aparece na prévia e fica após F5; "Remover" volta ao ícone padrão', async ({ page }) => {
  await openAnaProfile(page)
  await expect(page.getByRole('img', { name: 'Avatar padrão' })).toBeVisible()

  const sent = page.waitForResponse((r) => r.url().includes('/profile/avatar') && r.request().method() === 'PUT')
  await fileInput(page).setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByRole('img', { name: `Avatar de ${ANA.name}` })).toBeVisible()
  expect((await sent).status()).toBe(200)
  await expect(toast(page, 'Avatar atualizado')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('img', { name: `Avatar de ${ANA.name}` })).toBeVisible()

  const removed = page.waitForResponse((r) => r.url().includes('/profile/avatar') && r.request().method() === 'DELETE')
  await page.getByRole('button', { name: 'Remover avatar' }).click()
  await expect(page.getByRole('img', { name: 'Avatar padrão' })).toBeVisible()
  expect((await removed).status()).toBe(200)
  await page.reload()
  await expect(page.getByRole('img', { name: 'Avatar padrão' })).toBeVisible()
})

test('15c. avatar: falha de rede no envio mostra a prévia e depois faz rollback', async ({ page }) => {
  await openAnaProfile(page)
  await setLatency(page, 1_000)
  await page.evaluate(() => window.__mocks!.failNext({ method: 'PUT', path: '/api/profile/avatar', status: 'network', times: 1 }))

  await fileInput(page).setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByRole('img', { name: `Avatar de ${ANA.name}` })).toBeVisible({ timeout: 800 }) // otimista
  await expect(page.getByRole('img', { name: 'Avatar padrão' })).toBeVisible() // rollback
  await expect(page.getByRole('alert').filter({ hasText: /avatar|conex|rede/i })).toBeVisible()

  await setLatency(page, 150)
  await page.reload()
  await expect(page.getByRole('img', { name: 'Avatar padrão' })).toBeVisible()
})

test('16. senha: erros nos campos, sucesso limpa e avisa, nova vale e antiga não; senhas não vazam', async ({
  page,
  isMobile,
}) => {
  const NEW_PASSWORD = 'nova-senha-456'
  await openAnaProfile(page)
  const change = countRequests(page, 'PATCH', '/profile/password')
  const current = field(page, 'Senha atual')
  const next = field(page, 'Nova senha')
  const confirm = field(page, 'Confirmar nova senha')

  // Senha atual errada: erro do servidor no campo certo.
  await current.fill('errada-123')
  await next.fill(NEW_PASSWORD)
  await confirm.fill(NEW_PASSWORD)
  await save(page).click()
  await expectFieldError(current, 'Senha atual incorreta')
  expect(change.count).toBe(1)

  // Nova senha curta e confirmação diferente: erros locais, sem requisição.
  await current.fill(ANA.password)
  await next.fill('curta')
  await confirm.fill('diferente')
  await save(page).click()
  await expectFieldError(next, 'A senha deve ter pelo menos 8 caracteres')
  await expectFieldError(confirm, 'As senhas não coincidem')
  expect(change.count).toBe(1)

  // Sucesso.
  await next.fill(NEW_PASSWORD)
  await confirm.fill(NEW_PASSWORD)
  await save(page).click()
  await expect(toast(page, 'Senha alterada com sucesso')).toBeVisible()
  await expect(current).toHaveValue('')
  await expect(next).toHaveValue('')
  await expect(confirm).toHaveValue('')
  expect(change.count).toBe(2)

  // Nenhuma senha em storage nem no cache (consultas e variáveis de mutations).
  const secrets = [ANA.password, NEW_PASSWORD, 'errada-123']
  for (const entry of await appStorage(page)) {
    for (const secret of secrets) expect(entry.value, `valor de ${entry.key}`).not.toContain(secret)
  }
  const local = await page.evaluate(() =>
    [localStorage, sessionStorage].flatMap((s) =>
      Array.from({ length: s.length }, (_, i) => `${s.key(i)}=${s.getItem(s.key(i)!)}`),
    ),
  )
  for (const secret of secrets) expect(local.join('\n')).not.toContain(secret)
  const cache = JSON.stringify(await queryCache(page))
  for (const secret of secrets) expect(cache).not.toContain(secret)

  // A nova senha vale; a antiga não.
  await signOut(page, isMobile)
  await page.goto('/login')
  const old = await submitLoginForm(page, ANA.email, ANA.password)
  expect(old.status()).toBe(401)
  await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos' })).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
  await page.getByLabel(exactLabel('Senha')).fill(NEW_PASSWORD)
  const ok = page.waitForResponse((r) => r.url().includes('/auth/login'))
  await page.getByRole('button', { name: 'Entrar' }).click()
  expect((await ok).status()).toBe(200)
  await expect(page).not.toHaveURL(/\/login/)
})

test('17. dados não salvos: navegar mostra o diálogo com foco preso; Esc cancela', async ({ page }) => {
  await openAnaProfile(page)
  await field(page, 'Nome de exibição').fill('Alterado sem salvar')

  await goToAccountSection(page, 'Carteiras')
  const dialog = page.getByRole('dialog', { name: 'Descartar alterações?' })
  await expect(dialog).toBeVisible()
  await expect(page).toHaveURL(/\/profile$/)

  // Foco preso: Tab e Shift+Tab nunca saem do diálogo.
  const insideDialog = () =>
    dialog.evaluate((d) => d.contains(document.activeElement) && document.activeElement !== d)
  await expect.poll(insideDialog).toBe(true)
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab')
    // O foco pode passar um instante pelo "guard" do trap antes de voltar ao diálogo.
    await expect.poll(insideDialog, { message: `Tab ${i + 1}` }).toBe(true)
  }
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Shift+Tab')
    await expect.poll(insideDialog, { message: `Shift+Tab ${i + 1}` }).toBe(true)
  }

  // Esc cancela: continua no perfil, com o que foi digitado.
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(field(page, 'Nome de exibição')).toHaveValue('Alterado sem salvar')

  // Descartar leva à tela pedida.
  await goToAccountSection(page, 'Carteiras')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Descartar e sair' }).click()
  await expect(page).toHaveURL(/\/wallets$/)
})
