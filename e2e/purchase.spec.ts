import type { Page } from '@playwright/test'
import { expect, emitNftUpdate, setScenario, test } from './fixtures'
import {
  ANA_CART,
  DESIGN_TOTALS,
  INVALID_ADDRESS,
  INVALID_EMAIL,
  PICKS,
  WALLETS,
  dec,
  ethText,
  totalsOf,
  type CartExpectation,
  type Purchase,
} from './data'
import {
  apiAs,
  countRequests,
  expectFieldError,
  expectLoginRedirect,
  signIn,
  signOut,
  submitLoginForm,
} from './account-helpers'
import { USERS } from './credentials'
import {
  addFromDetail,
  apiCart,
  apiOrder,
  buyOnDetail,
  cartList,
  checkoutCta,
  checkoutField,
  chooseOnDetail,
  confirmButton,
  connectWallet,
  ensureCollectorForm,
  expectBadge,
  expectCartRows,
  expectCartSummary,
  expectCheckoutTotal,
  expectReceiptMatches,
  fillCollectorForm,
  gotoCheckout,
  payFromCart,
  prepareCheckout,
  readReceipt,
  receiptTitle,
  reviewDialog,
  sendOrder,
  setOrderSettleMs,
} from './shop-helpers'

/**
 * Compra (docs/SPEC.md, "Pagamento e confirmação", "Conta e sessão" e seção 9): do catálogo ao
 * recibo. Observa interface e resultado das operações; os dados vêm dos handlers MSW reais.
 */

test.describe.configure({ timeout: 90_000 })

const ANA = USERS.ana
const BRUNO = USERS.bruno

const line = (p: Purchase, quantity = p.quantity): CartExpectation => ({
  nftId: p.nft.id,
  editionId: p.edition.id,
  name: p.nft.name,
  tokenId: p.nft.tokenId,
  editionName: p.edition.name,
  quantity,
  unitPrice: p.nft.price,
  lineTotal: dec(p.nft.price).mul(quantity).toFixed(),
  max: Math.min(p.edition.available, p.edition.maxPerOrder),
})

/** Bruno entra (carrinho vazio) e põe um NFT no carrinho; termina em /cart. */
async function brunoWithCart(page: Page, picks: readonly Purchase[] = [PICKS[0]]) {
  await signIn(page, 'bruno')
  for (const pick of picks) await addFromDetail(page, pick)
  const lines = picks.map((p) => line(p))
  await expectCartRows(page, lines)
  await expectCartSummary(page, totalsOf(lines))
  return lines
}

// ---------------------------------------------------------------------------
// 10. Compra completa, do catálogo ao recibo
// ---------------------------------------------------------------------------

async function searchFor(page: Page, isMobile: boolean, term: string) {
  if (isMobile) {
    await page.getByRole('searchbox', { name: 'Explorar coleções' }).fill(term)
    return
  }
  const box = page.getByRole('searchbox', { name: 'Buscar NFTs' })
  if ((await box.count()) === 0) await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await box.fill(term)
}

/** Catálogo → busca → card → detalhe → edição e quantidade → COMPRAR. Termina em /cart. */
async function buyFromCatalog(page: Page, isMobile: boolean, pick: Purchase) {
  await page.goto('/')
  await searchFor(page, isMobile, pick.nft.name)
  // A busca entra na URL com atraso; só depois a lista está estável para clicar no card.
  await expect(page).toHaveURL(/[?&]q=/)
  const link = page
    .getByRole('region', { name: 'Catálogo de NFTs' })
    .getByRole('link', { name: `Ver ${pick.nft.name}` })
  await expect(link).toBeVisible()
  await link.click()
  await expect(page).toHaveURL(new RegExp(`/nft/${pick.nft.id}$`))
  await chooseOnDetail(page, pick)
  await buyOnDetail(page)
}

test('10. compra completa: catálogo, detalhe, carrinho, checkout, revisão, pendente e recibo confirmado', async ({
  page,
  isMobile,
}) => {
  await signIn(page, 'bruno')
  await setScenario(page, 'payment-confirmed')

  const pick = PICKS[0]
  await buyFromCatalog(page, isMobile, pick)
  const lines = [line(pick)]
  await expectCartRows(page, lines)
  await expectCartSummary(page, totalsOf(lines))

  // O formulário inteiro é preenchido com valores válidos, inclusive o endereço 0x com 40 hex.
  const paid = await payFromCart(page, isMobile, 'bruno')
  expect(WALLETS.bruno.address).toMatch(/^0x[0-9a-fA-F]{40}$/)

  // Resumo de antes = revisão (conferida no caminho) = recibo.
  expect(paid.before.items).toEqual([
    { name: pick.nft.name, quantity: pick.quantity, amount: lines[0].lineTotal },
  ])
  const expected = totalsOf(lines)
  expect(dec(paid.before.total).eq(expected.total)).toBe(true)
  await expectReceiptMatches(page, paid)
  expect(paid.receipt.txHash).toMatch(/^0x[0-9a-f]+$/i)
})

// ---------------------------------------------------------------------------
// 11. Validação do checkout
// ---------------------------------------------------------------------------

const REQUIRED_TEXT: [label: string, message: string][] = [
  ['Nome de exibição', 'Informe o nome de exibição'],
  ['Nome de usuário', 'Informe o nome de usuário'],
  ['Nome do perfil', 'Informe o nome do perfil'],
  ['Endereço da carteira', 'Informe o endereço da carteira'],
  ['Código de indicação', 'Informe o código de indicação'],
  ['E-mail', 'Informe o e-mail'],
  ['Nome ENS', 'Informe o nome ENS'],
]

test('11. validação: campos vazios, e-mail e endereço inválidos mostram erros associados e não abrem a revisão', async ({
  page,
  isMobile,
}) => {
  await brunoWithCart(page)
  await gotoCheckout(page, isMobile)
  const orders = countRequests(page, 'POST', '/orders')

  // Tudo vazio: "Revisar dados" leva os erros aos campos e o foco ao primeiro inválido.
  for (const [label] of REQUIRED_TEXT) await checkoutField(page, label).fill('')
  await expect(confirmButton(page)).toBeDisabled()
  await page.getByRole('button', { name: 'Revisar dados' }).click()
  for (const [label, message] of REQUIRED_TEXT) {
    await expectFieldError(checkoutField(page, label), message)
  }
  await expect(checkoutField(page, 'Nome de exibição')).toBeFocused()
  await expect(confirmButton(page)).toBeDisabled()
  await expect(reviewDialog(page)).toHaveCount(0)

  // Enviar com Enter também não abre a revisão.
  await page.keyboard.press('Enter')
  await expect(reviewDialog(page)).toHaveCount(0)

  // E-mail e endereço inválidos (o resto válido): o foco vai ao primeiro, na ordem do formulário.
  await fillCollectorForm(page, WALLETS.bruno)
  await checkoutField(page, 'E-mail').fill(INVALID_EMAIL)
  await checkoutField(page, 'Endereço da carteira').fill(INVALID_ADDRESS)
  await page.getByRole('button', { name: 'Revisar dados' }).click()
  await expectFieldError(checkoutField(page, 'E-mail'), /e-mail/i)
  await expectFieldError(
    checkoutField(page, 'Endereço da carteira'),
    'Endereço deve ter 0x seguido de 40 caracteres hexadecimais',
  )
  await expect(checkoutField(page, 'Endereço da carteira')).toBeFocused()
  // Campos corretos continuam sem erro.
  await expect(checkoutField(page, 'Nome de exibição')).not.toHaveAttribute('aria-invalid', 'true')
  await expect(confirmButton(page)).toBeDisabled()
  await expect(reviewDialog(page)).toHaveCount(0)

  // Corrigidos, mas sem carteira conectada: o envio segue desabilitado, com o motivo associado.
  await fillCollectorForm(page, WALLETS.bruno)
  await expect(confirmButton(page)).toBeDisabled()
  await expect(confirmButton(page)).toHaveAccessibleDescription('Conecte a carteira para confirmar a compra.')
  await expect(reviewDialog(page)).toHaveCount(0)

  // Conectada, libera.
  await page.getByRole('radio', { name: /^Principal/ }).check()
  await connectWallet(page)
  await expect(confirmButton(page)).toBeEnabled()
  expect(orders.count).toBe(0)
})

// ---------------------------------------------------------------------------
// 12. Revisão: voltar e editar
// ---------------------------------------------------------------------------

test('12. revisão: "Voltar e editar" fecha o diálogo sem enviar e mantém o rascunho', async ({
  page,
  isMobile,
}) => {
  await brunoWithCart(page)
  await checkoutCta(page).click()
  await expect(page).toHaveURL(/\/checkout$/)
  const wallet = await prepareCheckout(page, isMobile, 'bruno')
  const orders = countRequests(page, 'POST', '/orders')
  const note = 'Rascunho que não pode se perder'
  await page.getByLabel('Observação do colecionador (opcional)').fill(note)

  await confirmButton(page).click()
  await expect(reviewDialog(page)).toBeVisible()
  await reviewDialog(page).getByRole('button', { name: 'Voltar e editar' }).click()
  await expect(reviewDialog(page)).toHaveCount(0)

  // Nada foi enviado; formulário, carteira conectada e carrinho continuam como estavam.
  expect(orders.count).toBe(0)
  await ensureCollectorForm(page, isMobile)
  await expect(page.getByLabel('Observação do colecionador (opcional)')).toHaveValue(note)
  await expect(checkoutField(page, 'E-mail')).toHaveValue('colecionador.teste@example.com')
  await expect(page.getByText(/^Conectada:/)).toBeVisible()
  await expect(confirmButton(page)).toBeEnabled()
  expect((await apiCart(page)).items).toHaveLength(1)
  expect((await apiAs<{ items: unknown[] }>(page, 'GET', '/orders')).body.items.filter(
    (o) => (o as { status: string }).status === 'pending',
  )).toHaveLength(0)

  // O diálogo abre de novo normalmente.
  await confirmButton(page).click()
  await expect(reviewDialog(page)).toBeVisible()
  expect(wallet.nickname).toBe('Principal')
  await reviewDialog(page).getByRole('button', { name: 'Voltar e editar' }).click()
  expect(orders.count).toBe(0)
})

// ---------------------------------------------------------------------------
// 13. Pós-compra
// ---------------------------------------------------------------------------

test('13a. pós-compra: o carrinho perde só os itens e quantidades comprados e o badge muda', async ({
  page,
  isMobile,
}) => {
  const [bought, other] = PICKS
  await signIn(page, 'bruno')
  await setScenario(page, 'payment-confirmed')
  await addFromDetail(page, bought)
  const comprados = bought.quantity
  await expectBadge(page, comprados)

  // Com o pedido pendente, entram mais 1 unidade do mesmo item e outro NFT: não fazem parte da compra.
  const extra = { same: 1, other: other.quantity }
  const paid = await payFromCart(page, isMobile, 'bruno', {
    onPending: async () => {
      for (const [p, quantity] of [
        [bought, extra.same],
        [other, extra.other],
      ] as const) {
        const res = await apiAs(page, 'POST', '/cart/items', {
          nftId: p.nft.id,
          editionId: p.edition.id,
          quantity,
        })
        expect(res.status, JSON.stringify(res.body)).toBe(201)
      }
    },
  })
  expect(paid.receipt.items).toHaveLength(1)
  expect(paid.receipt.items[0].quantity).toBe(comprados)

  // Só o que foi comprado saiu: sobra o que entrou depois.
  await page.goto('/cart')
  const remaining = [line(bought, extra.same), line(other, extra.other)]
  await expectCartRows(page, remaining)
  await expectCartSummary(page, totalsOf(remaining))
  await expectBadge(page, extra.same + extra.other)
  expect((await apiCart(page)).items).toHaveLength(2)
})

test('13b. pós-compra: o recibo é terminal, sem nova compra, e /checkout não reenvia o pedido', async ({
  page,
  isMobile,
}) => {
  await brunoWithCart(page)
  await setScenario(page, 'payment-confirmed')
  const paid = await payFromCart(page, isMobile, 'bruno')
  const orders = countRequests(page, 'POST', '/orders')
  const before = (await apiAs<{ items: unknown[] }>(page, 'GET', '/orders')).body.items.length

  // Voltar ao recibo mostra o mesmo, sem nada que sugira comprar de novo.
  await page.goto(`/orders/${paid.id}`)
  const again = await readReceipt(page)
  expect(again).toEqual(paid.receipt)
  await expect(page.getByRole('button', { name: /comprar|nova compra|finalizar/i })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /comprar|nova compra|finalizar/i })).toHaveCount(0)

  // /checkout depois da compra: carrinho vazio, volta ao carrinho e nada é enviado.
  await page.goto('/checkout')
  await expect(page).toHaveURL(/\/cart$/)
  await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
  expect(orders.count).toBe(0)
  expect((await apiAs<{ items: unknown[] }>(page, 'GET', '/orders')).body.items).toHaveLength(before)
  expect((await apiOrder(page, paid.id)).body.status).toBe('confirmed')
})

// ---------------------------------------------------------------------------
// 14. Recibo imutável (snapshot)
// ---------------------------------------------------------------------------

test('14. snapshot: mudar o preço do NFT depois da compra não altera o recibo (nem com F5)', async ({
  page,
  isMobile,
}) => {
  await brunoWithCart(page)
  await setScenario(page, 'payment-confirmed')
  const paid = await payFromCart(page, isMobile, 'bruno')
  const pick = PICKS[0]

  // O preço muda pelo Socket.IO (e na API simulada).
  const newPrice = dec(pick.nft.price).add(1).toFixed()
  await emitNftUpdate(page, { nftId: pick.nft.id, price: newPrice })
  const nft = await apiAs<{ price: string }>(page, 'GET', `/nfts/${pick.nft.id}`)
  expect(nft.body.price).toBe(newPrice)

  // O recibo continua com os valores da compra.
  await page.goto(`/orders/${paid.id}`)
  expect(await readReceipt(page)).toEqual(paid.receipt)
  await page.reload()
  expect(await readReceipt(page)).toEqual(paid.receipt)
  const api = await apiOrder(page, paid.id)
  expect(dec(api.body.snapshot.total).eq(paid.before.total)).toBe(true)
  expect(dec(api.body.snapshot.items[0].lineTotal).eq(paid.before.items[0].amount)).toBe(true)

  // Já o detalhe do NFT mostra o preço novo.
  await page.goto(`/nft/${pick.nft.id}`)
  await expect(page.getByRole('heading', { level: 1, name: pick.nft.name })).toBeVisible()
  await expect(page.getByText(ethText(newPrice), { exact: true }).first()).toBeVisible()
})

// ---------------------------------------------------------------------------
// 15. Acesso ao recibo
// ---------------------------------------------------------------------------

test('15. acesso: sem sessão vai ao login; outro usuário recebe erro sem vazar dados do pedido', async ({
  page,
  isMobile,
}) => {
  await brunoWithCart(page)
  await setScenario(page, 'payment-confirmed')
  const paid = await payFromCart(page, isMobile, 'bruno')
  const path = `/orders/${paid.id}`
  const secrets = [
    paid.receipt.txHash,
    paid.receipt.txShort,
    paid.wallet.short,
    ...paid.before.items.map((i) => i.name),
  ]

  // Sem sessão: login, com retorno ao recibo.
  await page.goto('/')
  await signOut(page, isMobile)
  await page.goto(path)
  await expectLoginRedirect(page, path)

  // Ana entra e abre o recibo do Bruno: página de erro, sem nenhum dado do pedido.
  await submitLoginForm(page, ANA.email, ANA.password)
  await expect(page).toHaveURL(new RegExp(`${path}$`))
  await expect(page.getByRole('heading', { name: 'Pedido não encontrado' })).toBeVisible()
  await expect(receiptTitle(page)).toHaveCount(0)
  const text = await page.locator('body').innerText()
  for (const secret of secrets) expect(text, secret).not.toContain(secret)
  expect(text).not.toContain(ethText(paid.before.total))

  // A API também nega, sem devolver o pedido.
  const res = await apiOrder(page, paid.id)
  expect([403, 404]).toContain(res.status)
  const json = JSON.stringify(res.body)
  for (const secret of secrets) expect(json, secret).not.toContain(secret)
  expect(json).not.toContain(BRUNO.id)
})

// ---------------------------------------------------------------------------
// 16. Carrinho do design completo
// ---------------------------------------------------------------------------

test('16. carrinho do design: Ana compra os três itens, total 26.846 e recibo com 2.38, 8.34, 16.11 e taxa 0.016', async ({
  page,
  isMobile,
}) => {
  await signIn(page, 'ana')
  await setScenario(page, 'payment-confirmed')
  await page.goto('/cart')
  await expectCartRows(page, ANA_CART)
  await expectCartSummary(page, { ...totalsOf(ANA_CART), discount: '0' })

  const paid = await payFromCart(page, isMobile, 'ana')
  expect(dec(paid.before.total).eq(DESIGN_TOTALS.total), `total do resumo ${paid.before.total}`).toBe(true)
  await expectReceiptMatches(page, paid)

  const receipt = await readReceipt(page)
  expect(receipt.items.map((i) => i.name)).toEqual(ANA_CART.map((l) => l.name))
  for (const [i, l] of ANA_CART.entries()) {
    expect(receipt.items[i].quantity).toBe(l.quantity)
    expect(dec(receipt.items[i].amount).eq(l.lineTotal), l.name).toBe(true)
  }
  expect(dec(receipt.networkFee).eq(DESIGN_TOTALS.networkFee)).toBe(true)
  expect(dec(receipt.total).eq(DESIGN_TOTALS.total)).toBe(true)

  // Tudo foi comprado: o carrinho da Ana esvazia.
  await page.goto('/cart')
  await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
  await expect(cartList(page)).toHaveCount(0)
  expect((await apiCart(page)).items).toEqual([])
})

// ---------------------------------------------------------------------------
// 17. Mobile
// ---------------------------------------------------------------------------

test('17. mobile: o fluxo completo com menu inferior, cartões, seção recolhível e total fixo', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Controles exclusivos do tamanho mobile.')

  await signIn(page, 'bruno')
  await setScenario(page, 'payment-confirmed')
  await setOrderSettleMs(page, 4_000)
  const pick = PICKS[1]

  // Início: menu inferior com os quatro destinos e o carrinho vazio.
  const nav = page.getByRole('navigation', { name: 'Navegação principal' })
  for (const name of ['Início', 'Favoritos', 'Carrinho, 0 itens', 'Perfil']) {
    await expect(nav.getByRole('link', { name })).toBeVisible()
  }
  await buyFromCatalog(page, true, pick)

  // Detalhe, carrinho e pagamento trocam o menu inferior pelo painel próprio: cartão do item e
  // resumo fixo com "Conectar e finalizar".
  await expect(nav).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: 'Carrinho de NFTs' })).toBeVisible()
  const lines = [line(pick)]
  await expectCartRows(page, lines)
  await expectCartSummary(page, totalsOf(lines))
  await expect(page.getByRole('button', { name: `Remover ${pick.nft.name} do carrinho` })).toBeVisible()
  await expect(checkoutCta(page)).toBeInViewport()
  await expectBadge(page, pick.quantity)

  // Checkout: a seção do formulário começa recolhida e o total fica no painel fixo.
  await checkoutCta(page).click()
  await expect(page).toHaveURL(/\/checkout$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Pagamento com carteira' })).toBeVisible()
  const section = page.getByRole('button', { name: /^Dados do colecionador/ })
  await expect(section).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByLabel('Observação do colecionador (opcional)')).toBeHidden()
  await expectCheckoutTotal(page, true, totalsOf(lines).total)

  const wallet = await prepareCheckout(page, true, 'bruno')
  await expect(section).toHaveAttribute('aria-expanded', 'true')
  const paid = await sendOrder(page, true, wallet)
  await expectReceiptMatches(page, paid)
  expect(paid.before.items).toEqual([
    { name: pick.nft.name, quantity: pick.quantity, amount: lines[0].lineTotal },
  ])
})
