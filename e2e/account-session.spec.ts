import type { Page } from '@playwright/test'
import { expect, emitNftUpdate, emitOrderUpdate, test } from './fixtures'
import { USERS } from './credentials'
import {
  NEW_ACCOUNT,
  apiAs,
  apiWallets,
  appStorage,
  countRequests,
  createPendingOrder,
  exactLabel,
  expectFieldError,
  expectLoginRedirect,
  expectSignedIn,
  openCollectorForm,
  expectSignedOut,
  fillSignup,
  hrefOf,
  queryCache,
  queryKeysText,
  signIn,
  signOut,
  signUp,
  signupButton,
  submitLoginForm,
} from './account-helpers'

/**
 * Conta e sessão (docs/SPEC.md, "Conta e sessão" e seção 9): cadastro, login, rotas privadas,
 * expiração, logout e troca de usuário. A interface e o resultado das operações são observados;
 * os dados vêm dos handlers MSW reais.
 */

test.describe.configure({ timeout: 60_000 })

const ANA = USERS.ana
const BRUNO = USERS.bruno

// ---------------------------------------------------------------------------
// 1-3. Cadastro
// ---------------------------------------------------------------------------

test('1. cadastro: entra logado, mostra o nome e a sessão sobrevive ao F5', async ({ page, isMobile }) => {
  await signUp(page)
  await expectSignedIn(page, isMobile, NEW_ACCOUNT.name)

  await page.reload()
  await expectSignedIn(page, isMobile, NEW_ACCOUNT.name)
})

test('2. validação do cadastro: mensagens nos campos, sem enviar a requisição', async ({ page }) => {
  const register = countRequests(page, 'POST', '/auth/register')
  await page.goto('/signup')

  // Tudo vazio.
  await signupButton(page).click()
  await expectFieldError(page.getByLabel('Nome de usuário'), 'Informe o nome de usuário')
  await expectFieldError(page.getByLabel(exactLabel('E-mail')), 'Informe o e-mail')
  await expectFieldError(page.getByLabel(exactLabel('Senha')), 'Informe a senha')
  await expectFieldError(page.getByLabel('Confirmar senha'), 'Confirme a senha')

  // E-mail inválido, senha curta e confirmação diferente.
  await fillSignup(page, { name: 'Novo Colecionador', email: 'isto-nao-e-email', password: 'curta', confirm: 'outra' })
  await signupButton(page).click()
  await expectFieldError(page.getByLabel(exactLabel('E-mail')), 'E-mail inválido')
  await expectFieldError(page.getByLabel(exactLabel('Senha')), 'A senha deve ter pelo menos 8 caracteres')
  await expectFieldError(page.getByLabel('Confirmar senha'), 'As senhas não coincidem')
  await expect(page).toHaveURL(/\/signup/)
  expect(register.count, 'nenhuma requisição de cadastro foi enviada').toBe(0)

  // Corrigidos, o formulário envia (prova que o contador enxerga a requisição).
  await fillSignup(page, NEW_ACCOUNT)
  await signupButton(page).click()
  await expect(page).not.toHaveURL(/\/signup/)
  expect(register.count).toBe(1)
})

test('3. conflito de cadastro: e-mail de um usuário do seed aparece no campo e-mail', async ({ page }) => {
  await page.goto('/signup')
  await fillSignup(page, { name: 'Outra Pessoa', email: ANA.email, password: 'senha-nova-123' })
  await signupButton(page).click()

  await expectFieldError(page.getByLabel(exactLabel('E-mail')), 'E-mail já cadastrado')
  await expect(page).toHaveURL(/\/signup/)
})

// ---------------------------------------------------------------------------
// 4-5. Login e rotas privadas
// ---------------------------------------------------------------------------

test('4. login: senha errada avisa com role=alert; certo volta ao redirect; logado, /login vai para "/"', async ({
  page,
  isMobile,
}) => {
  await page.goto('/checkout')
  await expectLoginRedirect(page, '/checkout')

  const wrong = await submitLoginForm(page, ANA.email, 'senha-errada-1')
  expect(wrong.status()).toBe(401)
  await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos' })).toBeVisible()
  await expectLoginRedirect(page, '/checkout')

  await page.getByLabel(exactLabel('Senha')).fill(ANA.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/checkout$/)
  if (!isMobile) await expectSignedIn(page, false, ANA.name) // o mobile não tem header com o nome

  await page.goto('/login')
  await expect(page).toHaveURL(/\/$/)
})

for (const path of ['/checkout', '/profile', '/wallets', '/orders/qualquer-id']) {
  test(`5. rota privada ${path} sem sessão leva ao login com redirect`, async ({ page }) => {
    await page.goto(path)
    await expectLoginRedirect(page, path)
  })
}

// ---------------------------------------------------------------------------
// 6-7. Expiração
// ---------------------------------------------------------------------------

async function expireOnDetail(page: Page) {
  await signIn(page, 'ana')
  await page.goto('/nft/nft_002')
  const here = hrefOf(page)
  const favorite = page.getByRole('button', { name: 'Favoritar', exact: true })
  await expect(favorite).toBeEnabled()

  await page.evaluate(() => window.__mocks!.expireSessions())
  await favorite.click() // ação autenticada com o token vencido
  return here
}

test('6. expiração durante a navegação: a próxima ação vai ao login com redirect e depois volta à rota', async ({
  page,
}) => {
  const here = await expireOnDetail(page)
  await expectLoginRedirect(page, here)

  await submitLoginForm(page, ANA.email, ANA.password)
  await expect(page).toHaveURL(new RegExp(`${here}$`))
})

test('6b. expiração durante a navegação: a tela de login avisa que a sessão expirou', async ({ page }) => {
  const here = await expireOnDetail(page)
  await expectLoginRedirect(page, here)
  await expect(page.getByText(/sessão expirada/i)).toBeVisible()
})

test('7. expiração no checkout: volta ao /checkout com rascunho e carrinho preservados, sem pedido duplicado', async ({
  page,
  isMobile,
}) => {
  await signIn(page, 'ana')
  await page.goto('/checkout')
  await openCollectorForm(page, isMobile)
  const note = page.getByLabel('Observação do colecionador (opcional)')
  await note.fill('Rascunho antes de expirar')
  await expect
    .poll(async () =>
      (await appStorage(page)).some((e) => e.area === 'session' && e.value.includes('Rascunho antes de expirar')),
    )
    .toBe(true)
  const cartBefore = (await apiAs<{ items: unknown[] }>(page, 'GET', '/cart')).body.items.length
  const ordersBefore = (await apiAs<{ items: unknown[] }>(page, 'GET', '/orders')).body.items.length
  expect(cartBefore).toBeGreaterThan(0)

  await page.evaluate(() => window.__mocks!.expireSessions())
  // Ação autenticada do próprio checkout: conectar a carteira.
  await page.getByRole('radio', { name: 'MetaMask' }).check()
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expectLoginRedirect(page, '/checkout')

  await submitLoginForm(page, ANA.email, ANA.password)
  await expect(page).toHaveURL(/\/checkout$/)
  await openCollectorForm(page, isMobile)
  await expect(page.getByLabel('Observação do colecionador (opcional)')).toHaveValue('Rascunho antes de expirar')

  expect((await apiAs<{ items: unknown[] }>(page, 'GET', '/cart')).body.items).toHaveLength(cartBefore)
  expect((await apiAs<{ items: unknown[] }>(page, 'GET', '/orders')).body.items).toHaveLength(ordersBefore)
})

// ---------------------------------------------------------------------------
// 8. Logout
// ---------------------------------------------------------------------------

test('8. logout: encerra a sessão e não deixa dados da Ana em storage, cache nem socket', async ({
  page,
  isMobile,
}) => {
  await signIn(page, 'ana')
  const wallets = await apiWallets(page)
  expect(wallets.length).toBeGreaterThan(0)

  // Popula o que é do usuário: perfil, carteiras, carrinho, favoritos e rascunho do checkout.
  await page.goto('/profile')
  await expect(page.getByLabel(exactLabel('Nome de exibição'))).toHaveValue(ANA.name)
  await page.goto('/checkout')
  await openCollectorForm(page, isMobile)
  await page.getByLabel('Observação do colecionador (opcional)').fill('Dado pessoal do rascunho')
  await expect
    .poll(async () => (await appStorage(page)).some((e) => e.key.includes(ANA.id)))
    .toBe(true) // sem isto o teste não provaria nada
  const cacheBefore = await queryKeysText(page)
  expect(cacheBefore.some((k) => k.includes(ANA.id))).toBe(true)

  await page.goto('/')
  await signOut(page, isMobile)
  await expectSignedOut(page, isMobile)
  // Rotas privadas deixam de abrir.
  for (const path of ['/profile', '/wallets', '/checkout']) {
    await page.goto(path)
    await expectLoginRedirect(page, path)
  }

  const entries = await appStorage(page)
  for (const entry of entries) {
    expect(entry.key, `chave ${entry.key}`).not.toContain(ANA.id)
    for (const secret of [ANA.id, ANA.email, ...wallets.map((w) => w.address), 'Dado pessoal do rascunho']) {
      expect(entry.value, `valor de ${entry.key}`).not.toContain(secret)
    }
  }

  // Cache: nada de dados privados (sobra, no máximo, o carrinho de visitante e o catálogo).
  const keys = await queryKeysText(page)
  expect(keys.filter((k) => k.includes(ANA.id) || k.includes('"user"'))).toEqual([])
  const dump = JSON.stringify((await queryCache(page)).queries)
  for (const secret of [ANA.id, ANA.email, ...wallets.map((w) => w.address)]) {
    expect(dump).not.toContain(secret)
  }

  // Socket: o da sessão anterior está desconectado e sem listeners; nenhuma conexão é dela.
  await expect
    .poll(() =>
      page.evaluate(() => {
        type Count = { total: number; connected: boolean }
        const d = window.__realtime!.diagnostics() as { guest: boolean | null; previous: Count[] }
        return d.guest !== false && d.previous.every((s) => !s.connected && s.total === 0)
      }),
    )
    .toBe(true)
  const owners = await page.evaluate(() =>
    (window.__mocks!.listSockets() as { userId: string | null }[]).map((s) => s.userId),
  )
  expect(owners).not.toContain(ANA.id)
})

// ---------------------------------------------------------------------------
// 9. Troca de usuário
// ---------------------------------------------------------------------------

test('9. troca de usuário: nada da Ana aparece para o Bruno, nem após F5, e eventos dela não o afetam', async ({
  page,
  isMobile,
}) => {
  test.setTimeout(150_000) // dois logins, dois usuários e várias telas
  // --- Ana: nome, carrinho, favoritos, carteiras e perfil.
  await signIn(page, 'ana')
  await expectSignedIn(page, isMobile, ANA.name)
  await page.goto('/cart')
  await expect(page.getByText('Violet Nomad #314').first()).toBeVisible()
  await page.goto('/nft/nft_003')
  await expect(page.getByRole('button', { name: 'Favoritar', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.goto('/wallets')
  await expect(page.getByText('Reserva').first()).toBeVisible()
  const anaAddress = (await apiWallets(page)).find((w) => w.role === 'primary')!.address

  // Um pedido pendente da Ana (continua pendente: liquidação adiada).
  await page.evaluate(() => window.__mocks!.configure({ orderSettleMs: 600_000 }))
  const orderId = await createPendingOrder(page)

  await signOut(page, isMobile)

  // --- Bruno.
  await signIn(page, 'bruno')
  const expectNoTraceOfAna = async () => {
    await page.goto('/cart')
    await expect(page.getByText('Violet Nomad #314')).toHaveCount(0)
    await expect(page.getByText('Emerald Ape #042')).toHaveCount(0)
    await page.goto('/nft/nft_003')
    await expect(page.getByRole('button', { name: 'Favoritar', exact: true })).toHaveAttribute('aria-pressed', 'false')
    await page.goto('/wallets')
    await expect(page.getByText('Sem saldo').first()).toBeVisible()
    await expect(page.getByText('Reserva')).toHaveCount(0)
    await expect(page.locator(`input[value="${anaAddress}"]`)).toHaveCount(0)
    await page.goto('/profile')
    await expect(page.getByLabel(exactLabel('Nome de exibição'))).toHaveValue(BRUNO.name)
    await expect(page.getByLabel(exactLabel('E-mail'))).toHaveValue(BRUNO.email)
    await expect(page.getByText(ANA.name)).toHaveCount(0)
    if (!isMobile) {
      await expect(page.getByRole('button', { name: `Menu da conta de ${BRUNO.name}` })).toBeVisible()
      await expect(page.getByRole('button', { name: `Menu da conta de ${ANA.name}` })).toHaveCount(0)
    }
    const keys = await queryKeysText(page)
    expect(keys.filter((k) => k.includes(ANA.id))).toEqual([])
  }
  await expectNoTraceOfAna()
  await page.reload()
  await expectNoTraceOfAna()

  // --- order.updated de um pedido da Ana não altera nada na sessão do Bruno.
  await page.goto('/nft/nft_002') // fora do carrinho e dos favoritos do Bruno: a barreira abaixo não mexe no que é comparado
  await expect(page.getByRole('button', { name: 'Favoritar', exact: true })).toHaveAttribute('aria-pressed', 'false')
  const privateQueries = async () =>
    (await queryCache(page)).queries.filter(
      (q) => (q.queryKey[0] === 'user' || q.queryKey[0] === 'cart') && q.data !== undefined,
    )
  // Só compara depois que o carrinho e os favoritos do Bruno terminaram de carregar.
  await expect
    .poll(async () => {
      const keys = (await privateQueries()).map((q) => JSON.stringify(q.queryKey))
      return keys.some((k) => k.includes('"cart"')) && keys.some((k) => k.includes('favorites'))
    })
    .toBe(true)
  const privateBefore = JSON.stringify(await privateQueries())
  await emitOrderUpdate(page, { orderId, status: 'confirmed' })
  // Barreira: um evento de NFT enviado depois chega ao Bruno; os eventos são entregues em ordem.
  await emitNftUpdate(page, { nftId: 'nft_002', price: '1.5' })
  await expect
    .poll(async () =>
      (await queryCache(page)).queries.some(
        (q) => q.queryKey.includes('detail') && (q.data as { price?: string } | undefined)?.price === '1.5',
      ),
    )
    .toBe(true)
  const privateAfter = JSON.stringify(await privateQueries())
  expect(privateAfter).toBe(privateBefore)
  expect((await queryKeysText(page)).filter((k) => k.includes(ANA.id))).toEqual([])
  await expect(page.getByText(ANA.name)).toHaveCount(0)
  await page.goto('/profile')
  await expect(page.getByLabel(exactLabel('Nome de exibição'))).toHaveValue(BRUNO.name)
})
