import type { Page } from '@playwright/test'
import {
  apiAs,
  countRequests,
  createPendingOrder,
  expectLoginRedirect,
  signIn,
  signOut,
  submitLoginForm,
} from './account-helpers'
import { USERS, type UserKey } from './credentials'
import {
  ANA_CART,
  ANA_ITEMS,
  DESIGN_TOTALS,
  PICKS,
  dec,
  ethText,
  nftByName,
  totalsOf,
  type CartExpectation,
} from './data'
import {
  disconnectSockets,
  emitDuplicate,
  emitNftUpdate,
  emitOrderUpdate,
  emitStale,
  expect,
  expireSessions,
  holdOrdersPending,
  reconnectSockets,
  settleOrderSilently,
  socketStats,
  test,
  updateNftSilently,
  useClock,
} from './fixtures'
import {
  INDICATOR,
  advanceUntilConnected,
  anaAtCheckout,
  announcements,
  apiOrders,
  changesDialog,
  diagnostics,
  everAnnounced,
  expectApiCart,
  expectIndicatorQuiet,
  expectSamePage,
  flushEvents,
  indicator,
  markPage,
  openReview,
  pendingTitle,
  recordLiveRegions,
  rejectedTitle,
  sendButton,
  trackOrderPosts,
} from './resilience-helpers'
import {
  apiOrder,
  apiQuote,
  cartLink,
  cartRow,
  checkoutCta,
  expectBadge,
  expectCartRows,
  expectCartSummary,
  expectCheckoutTotal,
  orderIdFromUrl,
  plusOf,
  prepareCheckout,
  quantityOf,
  readReceipt,
  receiptTitle,
  reviewDialog,
  toLineRef,
} from './shop-helpers'

/**
 * Tempo real (docs/SPEC.md seção 7 e docs/REALTIME.md). Todo evento sai do Socket.IO simulado
 * (window.__mocks) e chega ao app pelo socket.io-client dele; nada aqui toca cache, setter ou
 * callback do app. O que se observa é a interface, as requisições e a API simulada; o diagnóstico
 * window.__realtime (só leitura) mostra listeners e o controle de versão do cliente.
 */

test.describe.configure({ timeout: 90_000 })

const ANA_LINES = ANA_CART.map(toLineRef)
const PENDING_KEY = `nft-marketplace:checkout:pending-order:${USERS.ana.id}`

const withPrice = (line: CartExpectation, price: string): CartExpectation => ({
  ...line,
  unitPrice: price,
  lineTotal: dec(price).mul(line.quantity).toFixed(),
})
const withQuantity = (line: CartExpectation, quantity: number): CartExpectation => ({
  ...line,
  quantity,
  lineTotal: dec(line.unitPrice).mul(quantity).toFixed(),
})
const replace = (lines: readonly CartExpectation[], next: CartExpectation) =>
  lines.map((l) => (l.nftId === next.nftId && l.editionId === next.editionId ? next : l))

const cartNotices = (page: Page) => page.getByRole('status').filter({ hasText: 'Seu carrinho mudou' })
const priceMessage = (name: string, from: string, to: string) =>
  `${name}: o preço ${dec(to).gt(from) ? 'subiu' : 'caiu'} de ${ethText(from)} para ${ethText(to)}. O resumo já usa o novo valor.`

/** Resumo do carrinho igual ao que POST /api/quote responde para os itens. */
async function expectSummaryMatchesQuote(page: Page, lines: readonly CartExpectation[]) {
  const quote = await apiQuote(page, lines.map(toLineRef))
  await expectCartSummary(page, quote)
  return quote
}

async function anaOnCart(page: Page) {
  await signIn(page, 'ana')
  await page.goto('/cart')
  await expectCartRows(page, ANA_CART)
  await expectCartSummary(page, totalsOf(ANA_CART))
}

/** Pedido da Ana enviado pelo checkout e segurado em "pending" (liquidação adiada). */
async function anaPendingOrder(page: Page, isMobile: boolean) {
  await anaAtCheckout(page, isMobile)
  await holdOrdersPending(page)
  const posts = trackOrderPosts(page)
  await openReview(page)
  await sendButton(page).click()
  await expect(page).toHaveURL(/\/orders\/[^/]+$/)
  await expect(pendingTitle(page)).toBeVisible()
  const id = orderIdFromUrl(page)
  expect((await apiOrder(page, id)).body.status).toBe('pending')
  return { id, posts }
}

/** Login pela interface sem recarregar a página (mantém o servidor simulado e seu histórico). */
async function signInInApp(page: Page, isMobile: boolean, user: UserKey) {
  if (isMobile) {
    await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Perfil' }).click()
  } else {
    await page.getByRole('link', { name: 'Entrar' }).click()
  }
  await expect(page).toHaveURL(/\/login/)
  await submitLoginForm(page, USERS[user].email, USERS[user].password)
  await expect(page).not.toHaveURL(/\/login/)
}

/** Mensagens "[realtime] ..." que o cliente registra no console ao descartar um evento. */
function realtimeConsole(page: Page) {
  const lines: string[] = []
  page.on('console', (message) => {
    if (message.text().includes('[realtime]')) lines.push(message.text())
  })
  return lines
}

// ---------------------------------------------------------------------------
// 9. Item do carrinho muda em tempo real
// ---------------------------------------------------------------------------

test('9a. preço muda com o item no carrinho: aviso, antes e depois na linha, resumo igual à cotação e anúncio, sem recarregar', async ({
  page,
  isMobile,
}) => {
  await anaOnCart(page)
  await markPage(page)
  await recordLiveRegions(page)
  const item = ANA_ITEMS.emerald
  const newPrice = dec(item.unitPrice).add('0.5').toFixed()

  await emitNftUpdate(page, { nftId: item.nftId, price: newPrice })

  const message = priceMessage(item.name, item.unitPrice, newPrice)
  await expect(cartNotices(page)).toContainText(message)
  const row = cartRow(page, item.name)
  await expect(row).toContainText(`Preço alterado: de ${ethText(item.unitPrice)} para ${ethText(newPrice)}`)
  if (!isMobile) await expect(row).toContainText(`Preço: ${ethText(newPrice)}`)
  const lines = replace(ANA_CART, withPrice(item, newPrice))
  await expect(row).toContainText(`Total: ${ethText(withPrice(item, newPrice).lineTotal)}`)
  const quote = await expectSummaryMatchesQuote(page, lines)
  expect(dec(quote.total).eq(totalsOf(lines).total)).toBe(true)
  expect(dec(quote.total).eq(DESIGN_TOTALS.total)).toBe(false)

  expect(await announcements(page, message)).toBe(1)
  await expectSamePage(page)
})

test('9b. disponibilidade cai abaixo da quantidade no carrinho: quantidade ajustada e informada, resumo igual à cotação', async ({
  page,
}) => {
  await anaOnCart(page)
  await markPage(page)
  await recordLiveRegions(page)
  const item = ANA_ITEMS.ivory
  const before = nftByName(item.name).editions.find((e) => e.id === item.editionId)!.available
  const available = 5
  expect(item.quantity).toBeGreaterThan(available)

  await emitNftUpdate(page, { nftId: item.nftId, availability: { [item.editionId]: available } })

  const reduced = `${item.name}: disponibilidade reduzida de ${before} para ${available} unidades.`
  const adjusted = `${item.name}: a quantidade foi ajustada de ${item.quantity} para ${available}, o máximo disponível agora.`
  await expect(cartNotices(page)).toContainText(reduced)
  await expect(cartNotices(page)).toContainText(adjusted)
  const row = cartRow(page, item.name)
  await expect(quantityOf(row)).toHaveText(String(available))
  await expect(row).toContainText(`Quantidade ajustada de ${item.quantity} para ${available}`)

  const lines = replace(ANA_CART, withQuantity(item, available))
  await expectApiCart(page, lines.map(toLineRef))
  await expect(row).toContainText(`Total: ${ethText(withQuantity(item, available).lineTotal)}`)
  const quote = await expectSummaryMatchesQuote(page, lines)
  expect(dec(quote.total).eq(totalsOf(lines).total)).toBe(true)

  expect(await announcements(page, reduced)).toBe(1)
  expect(await announcements(page, adjusted)).toBe(1)
  await expectSamePage(page)
})

// ---------------------------------------------------------------------------
// 10. Catálogo e detalhe
// ---------------------------------------------------------------------------

test('10a. catálogo: o evento atualiza o preço no card, sem refazer a lista', async ({ page }) => {
  const { nft } = PICKS[1]
  await page.goto(`/?q=${encodeURIComponent(nft.name)}`)
  const card = page
    .getByRole('region', { name: 'Catálogo de NFTs' })
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: `Ver ${nft.name}` }) })
  await expect(card).toContainText(ethText(nft.price))
  await markPage(page)
  await card.evaluate((el) => {
    ;(el as unknown as { __e2eCard?: boolean }).__e2eCard = true
  })
  const nftRequests = countRequests(page, 'GET', '/api/nfts')
  const newPrice = dec(nft.price).add('0.137').toFixed()

  await emitNftUpdate(page, { nftId: nft.id, price: newPrice })
  await expect(card).toContainText(ethText(newPrice))
  await flushEvents(page)

  // Mesmo card (o nó não foi recriado) e nenhuma releitura do catálogo.
  expect(await card.evaluate((el) => (el as unknown as { __e2eCard?: boolean }).__e2eCard === true)).toBe(true)
  expect(nftRequests.count).toBe(0)
  await expectSamePage(page)
})

test('10b. detalhe aberto: o evento atualiza o preço e anuncia a mudança, sem reler o NFT', async ({ page }) => {
  const { nft } = PICKS[1]
  await page.goto(`/nft/${nft.id}`)
  await expect(page.getByRole('heading', { level: 1, name: nft.name })).toBeVisible()
  // O preço abre o elemento dele (no desktop o preço antigo riscado vem logo depois, no mesmo <p>).
  const priceText = (value: string) => page.getByText(new RegExp(`^${ethText(value).replace('.', '\\.')}`))
  await expect(priceText(nft.price).first()).toBeVisible()
  await markPage(page)
  await recordLiveRegions(page)
  const nftRequests = countRequests(page, 'GET', '/api/nfts')
  // Três casas: um valor que não aparece em nenhum outro lugar da tela.
  const newPrice = dec(nft.price).add('0.137').toFixed()

  await emitNftUpdate(page, { nftId: nft.id, price: newPrice })
  await expect(priceText(newPrice).first()).toBeVisible()
  const message = `O preço de ${nft.name} mudou de ${ethText(nft.price)} para ${ethText(newPrice)}.`
  await expect.poll(() => announcements(page, message)).toBe(1)
  await flushEvents(page)

  expect(nftRequests.count).toBe(0)
  await expectSamePage(page)
})

// ---------------------------------------------------------------------------
// 11. Checkout com cotação desatualizada
// ---------------------------------------------------------------------------

test('11a. checkout com a revisão aberta: o evento bloqueia "Enviar pedido", mostra antes e depois e só a nova confirmação envia', async ({
  page,
  isMobile,
}) => {
  await signIn(page, 'ana')
  await anaAtCheckout(page, isMobile)
  const posts = trackOrderPosts(page)
  await openReview(page)
  const item = ANA_ITEMS.emerald
  const newPrice = dec(item.unitPrice).add('0.5').toFixed()

  await emitNftUpdate(page, { nftId: item.nftId, price: newPrice })

  const dialog = changesDialog(page)
  await expect(dialog).toBeVisible()
  await expect(reviewDialog(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Enviar pedido' })).toHaveCount(0)
  const change = dialog.getByRole('listitem').filter({ hasText: `${item.name}: preço unitário` })
  await expect(change).toContainText(`Antes: ${ethText(item.unitPrice)}`)
  await expect(change).toContainText(`Agora: ${ethText(newPrice)}`)
  const quote = await apiQuote(page, ANA_LINES)
  expect(dec(quote.total).eq(totalsOf(replace(ANA_CART, withPrice(item, newPrice))).total)).toBe(true)
  await expect(dialog.getByText(`Novo total: ${ethText(quote.total)}`)).toBeVisible()
  const total = dialog.getByRole('listitem').filter({ hasText: /^Total/ })
  await expect(total).toContainText(`Antes: ${ethText(DESIGN_TOTALS.total)}`)
  await expect(total).toContainText(`Agora: ${ethText(quote.total)}`)
  expect(posts.requests).toHaveLength(0)

  // Só a nova confirmação do usuário envia, e com os valores novos.
  await dialog.getByRole('button', { name: 'Confirmar novos valores' }).click()
  await expect.poll(() => posts.requests.length).toBe(1)
  await expect(page).toHaveURL(/\/orders\/[^/]+$/)
  const order = await apiOrder(page, orderIdFromUrl(page))
  expect(dec(order.body.snapshot.total).eq(quote.total)).toBe(true)
  expect(posts.requests).toHaveLength(1)
})

test('11b. checkout com o formulário preenchido e o diálogo fechado: a mudança aparece em texto e só a nova confirmação envia', async ({
  page,
  isMobile,
}) => {
  await signIn(page, 'ana')
  await anaAtCheckout(page, isMobile)
  await expectCheckoutTotal(page, isMobile, DESIGN_TOTALS.total)
  await markPage(page)
  const posts = trackOrderPosts(page)
  const item = ANA_ITEMS.emerald
  const newPrice = dec(item.unitPrice).add('0.5').toFixed()

  // O evento só chega a quem já está conectado: sem esperar o handshake do socket (a página
  // acabou de carregar), emitir cedo demais perde o evento e o aviso nunca aparece.
  await expect.poll(async () => (await diagnostics(page)).status).toBe('connected')
  await emitNftUpdate(page, { nftId: item.nftId, price: newPrice })

  const quote = await apiQuote(page, ANA_LINES)
  expect(dec(quote.total).eq(DESIGN_TOTALS.total)).toBe(false)
  await expectCheckoutTotal(page, isMobile, quote.total)
  // A tela informa a mudança com o preço anterior e o novo em texto (o resumo do checkout só
  // mostra totais por linha, então o preço unitário antigo só aparece num aviso da mudança).
  // Soft: se faltar, o resto do caso (bloqueio e envio só com a cotação nova) ainda é conferido.
  await expect.soft(
    page
      .locator('p, li')
      .filter({ hasText: ethText(item.unitPrice) })
      .filter({ hasText: ethText(newPrice) })
      .first(),
  ).toBeVisible()
  expect(posts.requests).toHaveLength(0)

  // Nova confirmação: a revisão já vem com a cotação nova, e o pedido sai com ela.
  await openReview(page)
  await expect(
    reviewDialog(page).locator('dt', { hasText: /^Total$/ }).locator('xpath=following-sibling::dd[1]'),
  ).toHaveText(ethText(quote.total))
  await sendButton(page).click()
  await expect(page).toHaveURL(/\/orders\/[^/]+$/)
  expect(posts.requests).toHaveLength(1)
  const order = await apiOrder(page, orderIdFromUrl(page))
  expect(dec(order.body.snapshot.total).eq(quote.total)).toBe(true)
  await expectSamePage(page)
})

// ---------------------------------------------------------------------------
// 12. Duplicados e antigos
// ---------------------------------------------------------------------------

test('12. duplicado e antigo não repetem aviso nem regridem; depois de reconectar, o antigo é descartado pela version do cache', async ({
  page,
  isMobile,
}) => {
  await useClock(page)
  await anaOnCart(page)
  await markPage(page)
  await recordLiveRegions(page)
  const item = ANA_ITEMS.emerald
  const row = cartRow(page, item.name)
  const p1 = dec(item.unitPrice).add('0.1').toFixed()
  const p2 = dec(item.unitPrice).add('0.2').toFixed()
  const first = priceMessage(item.name, item.unitPrice, p1)
  const second = priceMessage(item.name, p1, p2)
  const regressed = `de ${ethText(p2)} para ${ethText(p1)}`

  await emitNftUpdate(page, { nftId: item.nftId, price: p1 })
  await expect(cartNotices(page)).toContainText(first)
  await emitNftUpdate(page, { nftId: item.nftId, price: p2 })
  await expect(cartNotices(page)).toContainText(second)

  // Duplicado (mesmo id) e antigo (o evento do p1, version anterior).
  await emitDuplicate(page)
  await emitStale(page)

  // A queda e a volta do socket servem de barreira: as mensagens anteriores já foram tratadas.
  await disconnectSockets(page)
  await expect(indicator(page, INDICATOR.reconnecting)).toBeVisible()
  await reconnectSockets(page)
  await advanceUntilConnected(page)

  const expectStill = async () => {
    await expect(row).toContainText(`Total: ${ethText(withPrice(item, p2).lineTotal)}`)
    if (!isMobile) await expect(row).toContainText(`Preço: ${ethText(p2)}`)
    await expect(page.getByText(second)).toHaveCount(1)
    expect(await announcements(page, second)).toBe(1)
    expect(await everAnnounced(page, regressed)).toBe(false)
    await expectSummaryMatchesQuote(page, replace(ANA_CART, withPrice(item, p2)))
  }
  await expectStill()

  // Reconectar zera o controle de versão do cliente...
  expect((await diagnostics(page)).trackedResources).toBe(0)
  // ...e o evento antigo do p1 ainda é descartado, agora pela version do NFT em cache.
  await emitStale(page)
  await flushEvents(page)
  await expectStill()
  expect((await apiAs<{ price: string }>(page, 'GET', `/nfts/${item.nftId}`)).body.price).toBe(p2)
  await expectSamePage(page)
})

// ---------------------------------------------------------------------------
// 13. Reconexão com reconciliação
// ---------------------------------------------------------------------------

test('13. reconexão: evento perdido na queda é recuperado pela API, e o indicador mostra a queda e a volta (quieto quando conectado)', async ({
  page,
}) => {
  await useClock(page)
  await anaOnCart(page)
  await markPage(page)
  await expect.poll(async () => (await diagnostics(page)).status).toBe('connected')
  await expectIndicatorQuiet(page)

  await disconnectSockets(page)
  await expect(indicator(page, INDICATOR.reconnecting)).toBeVisible()

  // Preço muda no servidor durante a queda, sem evento.
  const item = ANA_ITEMS.violet
  const newPrice = dec(item.unitPrice).add('0.3').toFixed()
  await updateNftSilently(page, { nftId: item.nftId, price: newPrice })
  const row = cartRow(page, item.name)
  await expect(row).toContainText(`Total: ${ethText(item.lineTotal)}`)

  await reconnectSockets(page)
  await advanceUntilConnected(page)
  await expect(indicator(page, INDICATOR.restored)).toBeVisible()

  // Reconciliação pelo REST, sem recarregar.
  const lines = replace(ANA_CART, withPrice(item, newPrice))
  await expect(row).toContainText(`Total: ${ethText(withPrice(item, newPrice).lineTotal)}`)
  await expectSummaryMatchesQuote(page, lines)
  await expectSamePage(page)

  // Conectado de novo: o aviso some e o indicador volta a ficar quieto.
  await page.clock.fastForward(3_500)
  await expectIndicatorQuiet(page)
})

// ---------------------------------------------------------------------------
// 14. order.updated
// ---------------------------------------------------------------------------

test('14a. order.updated confirmed: recibo sem recarregar, pendente esquecido, carrinho e catálogo atualizados, um anúncio', async ({
  page,
  isMobile,
}) => {
  await signIn(page, 'ana')
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'Catálogo de NFTs' }).getByRole('listitem').first()).toBeVisible()
  // Daqui em diante, só navegação dentro do app (o cache do catálogo continua o mesmo).
  await holdOrdersPending(page)
  await cartLink(page).click()
  await expect(page).toHaveURL(/\/cart$/)
  await expectCartRows(page, ANA_CART)
  await checkoutCta(page).click()
  await expect(page).toHaveURL(/\/checkout$/)
  await prepareCheckout(page, isMobile, 'ana')
  await markPage(page)
  await openReview(page)
  await sendButton(page).click()
  await expect(pendingTitle(page)).toBeVisible()
  const id = orderIdFromUrl(page)
  expect(await page.evaluate((k) => localStorage.getItem(k), PENDING_KEY)).toBe(JSON.stringify(id))
  await recordLiveRegions(page)
  const nftRequests = countRequests(page, 'GET', '/api/nfts')

  await emitOrderUpdate(page, { orderId: id, status: 'confirmed' })

  await expect(receiptTitle(page)).toBeVisible()
  const announcement = 'Pedido confirmado. Seus NFTs agora estão na sua carteira.'
  await expect.poll(() => announcements(page, announcement)).toBe(1)
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), PENDING_KEY)).toBeNull()
  await expectApiCart(page, [])
  await expectSamePage(page)

  // Carrinho e catálogo: ao voltar ao início, o catálogo é relido e o carrinho está vazio.
  await page.getByRole('link', { name: 'Fechar e ir para o início' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect.poll(() => nftRequests.count).toBeGreaterThan(0)
  await expectBadge(page, 0)
  expect(await announcements(page, announcement)).toBe(1)
  await expectSamePage(page)
})

test('14b. order.updated rejected: recusa sem recarregar, carrinho preservado e um anúncio', async ({
  page,
  isMobile,
}) => {
  await signIn(page, 'ana')
  const { id } = await anaPendingOrder(page, isMobile)
  await markPage(page)
  await recordLiveRegions(page)

  await emitOrderUpdate(page, { orderId: id, status: 'rejected' })

  await expect(rejectedTitle(page)).toBeVisible()
  const reason = ((await apiOrder(page, id)).body as unknown as { rejectionReason: string }).rejectionReason
  await expect(page.locator('p', { hasText: `Motivo: ${reason}` })).toBeVisible()
  await expect(receiptTitle(page)).toHaveCount(0)
  const announcement = 'Pagamento recusado. Seus itens continuam no carrinho.'
  await expect.poll(() => announcements(page, announcement)).toBe(1)
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), PENDING_KEY)).toBeNull()
  await expectApiCart(page, ANA_LINES)
  await expectSamePage(page)

  await page.getByRole('link', { name: 'Voltar ao pagamento' }).click()
  await expect(page).toHaveURL(/\/checkout$/)
  await expectCheckoutTotal(page, isMobile, DESIGN_TOTALS.total)
})

// ---------------------------------------------------------------------------
// 15. Estados terminais
// ---------------------------------------------------------------------------

test('15. terminal: depois de confirmed, o pending antigo e o duplicado não regridem a tela nem repetem efeitos', async ({
  page,
  isMobile,
}) => {
  await signIn(page, 'ana')
  const { id } = await anaPendingOrder(page, isMobile)
  await markPage(page)
  await recordLiveRegions(page)
  await emitOrderUpdate(page, { orderId: id, status: 'confirmed' })
  await expect(receiptTitle(page)).toBeVisible()
  const announcement = 'Pedido confirmado. Seus NFTs agora estão na sua carteira.'
  await expect.poll(() => announcements(page, announcement)).toBe(1)
  await expectApiCart(page, [])
  const receipt = await readReceipt(page)
  // A região do pendente já dizia "Aguardando confirmação" quando a gravação começou.
  const pendingShown = await announcements(page, 'Aguardando confirmação')
  const cartWrites = ['POST', 'PATCH', 'PUT', 'DELETE'].map((m) => countRequests(page, m, '/api/cart'))

  // O pending antigo (version 1, o evento real da criação) e o confirmed repetido.
  await emitStale(page)
  await emitDuplicate(page)
  await flushEvents(page)

  await expect(receiptTitle(page)).toBeVisible()
  await expect(pendingTitle(page)).toHaveCount(0)
  expect(await readReceipt(page)).toEqual(receipt)
  expect(await announcements(page, announcement)).toBe(1)
  expect(await announcements(page, 'Aguardando confirmação')).toBe(pendingShown)
  expect(cartWrites.map((c) => c.count)).toEqual([0, 0, 0, 0])
  await expectApiCart(page, [])
  const api = await apiOrder(page, id)
  expect(api.body.status).toBe('confirmed')
  await expectSamePage(page)
})

// ---------------------------------------------------------------------------
// 16. Pedido pendente com queda de conexão
// ---------------------------------------------------------------------------

for (const recovery of ['reconectar', 'recarregar'] as const) {
  test(`16. pendente com queda: confirmado no servidor sem evento, recuperado ao ${recovery}, sem outra compra`, async ({
    page,
    isMobile,
  }) => {
    await useClock(page)
    await signIn(page, 'ana')
    const ordersBefore = await apiOrders(page)
    const { id, posts } = await anaPendingOrder(page, isMobile)

    await disconnectSockets(page)
    await expect(indicator(page, INDICATOR.reconnecting)).toBeVisible()
    await expect(pendingTitle(page)).toBeVisible()
    await expect(
      page.getByText(
        'Você pode recarregar esta página: o mesmo pedido continua sendo acompanhado e nenhuma outra compra é criada.',
      ),
    ).toBeVisible()

    // Confirmado no servidor durante a queda: o order.updated se perde.
    expect((await settleOrderSilently(page, id, 'confirmed'))?.status).toBe('confirmed')

    if (recovery === 'reconectar') {
      await reconnectSockets(page)
      await advanceUntilConnected(page)
    } else {
      await page.reload()
    }
    await expect(receiptTitle(page)).toBeVisible({ timeout: 20_000 })
    expect(orderIdFromUrl(page)).toBe(id)

    expect(posts.requests).toHaveLength(1)
    const ordersAfter = await apiOrders(page)
    expect(ordersAfter).toHaveLength(ordersBefore.length + 1)
    expect(ordersAfter.find((o) => o.id === id)?.status).toBe('confirmed')
  })
}

// ---------------------------------------------------------------------------
// 17. Recarregar em pending
// ---------------------------------------------------------------------------

test('17. F5 no pendente e /checkout depois: o mesmo pedido, sem novo POST nem segunda compra', async ({
  page,
  isMobile,
}) => {
  await signIn(page, 'ana')
  const ordersBefore = await apiOrders(page)
  const { id, posts } = await anaPendingOrder(page, isMobile)

  await page.reload()
  await expect(pendingTitle(page)).toBeVisible()
  await expect(page.getByText(`Pedido ${id}`)).toBeVisible()

  await page.goto('/checkout')
  await expect(page).toHaveURL(new RegExp(`/orders/${id}$`))
  await expect(pendingTitle(page)).toBeVisible()

  expect(posts.requests).toHaveLength(1)
  const ordersAfter = await apiOrders(page)
  expect(ordersAfter).toHaveLength(ordersBefore.length + 1)
  expect(ordersAfter.find((o) => o.id === id)?.status).toBe('pending')

  // O mesmo pedido termina normalmente.
  await emitOrderUpdate(page, { orderId: id, status: 'confirmed' })
  await expect(receiptTitle(page)).toBeVisible()
  expect(posts.requests).toHaveLength(1)
  expect(await apiOrders(page)).toHaveLength(ordersBefore.length + 1)
})

// ---------------------------------------------------------------------------
// 18. Isolamento de eventos
// ---------------------------------------------------------------------------

test('18a. isolamento: order.updated do pedido da Ana não chega ao cliente do Bruno nem muda nada na sessão dele', async ({
  page,
  isMobile,
}) => {
  await signIn(page, 'ana')
  await holdOrdersPending(page)
  const anaOrder = await createPendingOrder(page)
  await page.goto('/')
  await signOut(page, isMobile)

  await signIn(page, 'bruno')
  await page.goto('/cart')
  await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
  await expect.poll(async () => (await diagnostics(page)).status).toBe('connected')
  const logs = realtimeConsole(page)
  const owners = await page.evaluate(() => window.__mocks!.listSockets().map((s) => s.userId))
  expect(owners).not.toContain(USERS.ana.id)
  const tracked = (await diagnostics(page)).trackedResources

  const event = await emitOrderUpdate(page, { orderId: anaOrder, status: 'confirmed' })
  expect(event?.type === 'order.updated' && event.userId).toBe(USERS.ana.id)
  await flushEvents(page)

  // O cliente do Bruno não recebeu o evento: nem o descartou, nem o registrou.
  expect(logs.filter((l) => l.includes('other-user'))).toEqual([])
  expect((await diagnostics(page)).trackedResources).toBe(tracked + 1) // só o sentinela
  // Controle positivo: o console do cliente é capturado (um duplicado público é descartado e logado).
  await emitDuplicate(page)
  await expect.poll(() => logs.some((l) => l.includes('descartado (duplicate)'))).toBe(true)

  await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
  expect(await apiOrders(page)).toEqual([])
  expect([403, 404]).toContain((await apiOrder(page, anaOrder)).status)
})

test('18b. isolamento: depois de sair e entrar como outro usuário, eventos da sessão anterior não atualizam os dados do novo', async ({
  page,
  isMobile,
}) => {
  await signIn(page, 'ana')
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'Catálogo de NFTs' })).toBeVisible()
  await holdOrdersPending(page)
  const anaOrder = await createPendingOrder(page)
  await emitOrderUpdate(page, { orderId: anaOrder, status: 'confirmed' })

  // Troca de usuário sem recarregar: o servidor simulado guarda o histórico de eventos da Ana.
  await signOut(page, isMobile)
  await signInInApp(page, isMobile, 'bruno')
  await expect.poll(async () => (await diagnostics(page)).status).toBe('connected')
  await expect.poll(async () => (await diagnostics(page)).guest).toBe(false)
  const logs = realtimeConsole(page)
  const tracked = (await diagnostics(page)).trackedResources

  // Reenvio do order.updated da Ana e o pending antigo dela.
  expect((await emitDuplicate(page))?.type).toBe('order.updated')
  expect((await emitStale(page))?.resource.id).toBe(anaOrder)
  await flushEvents(page)

  expect(logs.filter((l) => l.includes('other-user'))).toEqual([])
  expect((await diagnostics(page)).trackedResources).toBe(tracked + 1)
  const d = await diagnostics(page)
  expect(d.previous.every((s) => !s.connected && s.total === 0)).toBe(true)
  expect(await apiOrders(page)).toEqual([])
  await expectApiCart(page, [])
  await page.goto('/cart')
  await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
})

// ---------------------------------------------------------------------------
// 19. Limpeza
// ---------------------------------------------------------------------------

test('19a. logout: o socket da sessão fica sem listeners e o controle de versão zerado', async ({
  page,
  isMobile,
}) => {
  // Na página inicial: no mobile o "Sair" fica no perfil, aberto pela barra inferior daqui.
  await signIn(page, 'ana')
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'Catálogo de NFTs' })).toBeVisible()
  await expect.poll(async () => (await diagnostics(page)).status).toBe('connected')
  await flushEvents(page)
  const before = await diagnostics(page)
  expect(before.guest).toBe(false)
  expect(before.current).toMatchObject({ nftUpdated: 1, orderUpdated: 1, connected: true })
  expect(before.trackedResources).toBeGreaterThan(0)

  await signOut(page, isMobile)

  await expect
    .poll(async () => {
      const d = await diagnostics(page)
      return {
        guest: d.guest,
        previousClean: d.previous.length > 0 && d.previous.every((s) => !s.connected && s.total === 0),
        guestListeners: d.current ? { nft: d.current.nftUpdated, order: d.current.orderUpdated } : null,
        tracked: d.trackedResources,
      }
    })
    .toEqual({ guest: true, previousClean: true, guestListeners: { nft: 1, order: 0 }, tracked: 0 })
  const owners = await page.evaluate(() => window.__mocks!.listSockets().map((s) => s.userId))
  expect(owners).not.toContain(USERS.ana.id)
})

test('19b. navegar várias vezes entre catálogo, detalhe e carrinho não aumenta os listeners', async ({
  page,
}) => {
  await signIn(page, 'ana')
  await page.goto('/')
  const catalog = page.getByRole('region', { name: 'Catálogo de NFTs' })
  await expect(catalog.getByRole('listitem').first()).toBeVisible()
  await expect.poll(async () => (await diagnostics(page)).status).toBe('connected')
  await markPage(page)

  const snapshot = async () => {
    const d = await diagnostics(page)
    return { socket: d.current, screens: d.screenSubscriptions }
  }
  const home = await snapshot()
  expect(home.socket).toMatchObject({ nftUpdated: 1, orderUpdated: 1, connected: true })
  /** Assinaturas de tela além das do início (o efeito da tela registra depois do primeiro render). */
  const extra = (s: Awaited<ReturnType<typeof snapshot>>) =>
    s.screens['nft.updated'] - home.screens['nft.updated'] + s.screens['order.updated'] - home.screens['order.updated']

  const openDetail = async () => {
    await catalog.getByRole('link', { name: /^Ver / }).first().click()
    await expect(page).toHaveURL(/\/nft\//)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  }
  const openCart = async () => {
    await cartLink(page).click()
    await expect(page).toHaveURL(/\/cart$/)
    await expectCartRows(page, ANA_CART)
  }
  const backHome = async () => {
    await page.goBack()
    await expect(catalog.getByRole('listitem').first()).toBeVisible()
    // Ao sair da tela, as assinaturas dela são liberadas: tudo volta ao que era no início.
    await expect.poll(snapshot).toEqual(home)
  }

  // Primeira visita: a tela assina o tempo real (mais que o início) e essa é a referência dela.
  await openDetail()
  await expect.poll(async () => extra(await snapshot())).toBeGreaterThan(0)
  const detailRef = await snapshot()
  await backHome()
  await openCart()
  await expect.poll(async () => extra(await snapshot())).toBeGreaterThan(0)
  const cartRef = await snapshot()
  await backHome()

  // Visitas seguintes: as mesmas contagens, sem acumular (o socket segue com 1 listener por evento).
  for (let round = 0; round < 3; round++) {
    await openDetail()
    await expect.poll(snapshot).toEqual(detailRef)
    await backHome()
    await openCart()
    await expect.poll(snapshot).toEqual(cartRef)
    await backHome()
  }
  expect(detailRef.socket).toEqual(home.socket)
  expect(cartRef.socket).toEqual(home.socket)
  await expectSamePage(page)
})

test('19c. sessão expirada derruba o socket sem novas tentativas, e a próxima ação mostra o erro de sessão', async ({
  page,
}) => {
  await useClock(page)
  await anaOnCart(page)
  await expect.poll(async () => (await diagnostics(page)).status).toBe('connected')

  await expireSessions(page, USERS.ana.id)
  // O servidor confere a sessão a cada entrega: o próximo evento derruba a conexão da Ana.
  await emitNftUpdate(page, { nftId: PICKS[2].nft.id, price: '3.33' })
  await expect(indicator(page, INDICATOR.disconnected)).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => window.__mocks!.listSockets().map((s) => s.userId)))
    .not.toContain(USERS.ana.id)

  // Nenhuma tentativa nova, por mais tempo que passe.
  const stats = await socketStats(page)
  for (let i = 0; i < 6; i++) await page.clock.fastForward(10_000)
  expect(await socketStats(page)).toEqual(stats)
  expect((await diagnostics(page)).status).toBe('disconnected')
  await expect(indicator(page, INDICATOR.disconnected)).toBeVisible()

  // A próxima ação autenticada mostra a sessão expirada e leva ao login com retorno.
  const line = ANA_CART.find((l) => l.quantity < l.max)!
  await plusOf(cartRow(page, line.name)).click()
  await expectLoginRedirect(page, '/cart')
  await expect(page.getByText('Sua sessão expirou. Entre novamente para continuar.')).toBeVisible()
})

test('19d. reconectar com a sessão expirada: CONNECT_ERROR de sessão, uma tentativa só, e o erro de sessão na próxima ação', async ({
  page,
}) => {
  await useClock(page)
  await anaOnCart(page)
  await expect.poll(async () => (await diagnostics(page)).status).toBe('connected')

  await disconnectSockets(page)
  await expect(indicator(page, INDICATOR.reconnecting)).toBeVisible()
  await expireSessions(page, USERS.ana.id)
  await reconnectSockets(page)

  // A reconexão é recusada pela sessão vencida, e o cliente para de tentar.
  await expect
    .poll(
      async () => {
        await page.clock.fastForward(1_000)
        return (await socketStats(page)).rejected
      },
      { timeout: 30_000, intervals: [100] },
    )
    .toBe(1)
  await expect(indicator(page, INDICATOR.disconnected)).toBeVisible()
  const stats = await socketStats(page)
  for (let i = 0; i < 6; i++) await page.clock.fastForward(10_000)
  expect(await socketStats(page)).toEqual(stats)
  expect((await diagnostics(page)).status).toBe('disconnected')

  const line = ANA_CART.find((l) => l.quantity < l.max)!
  await plusOf(cartRow(page, line.name)).click()
  await expectLoginRedirect(page, '/cart')
  await expect(page.getByText('Sua sessão expirou. Entre novamente para continuar.')).toBeVisible()
})
