import type { Page } from '@playwright/test'
import Decimal from 'decimal.js'
import { apiAs, expectLoginRedirect, signIn, submitLoginForm, TOKEN_KEY } from './account-helpers'
import { USERS } from './credentials'
import { ANA_CART, DESIGN_TOTALS, PICKS, dec, ethText } from './data'
import { expect, setScenario, test, useClock } from './fixtures'
import {
  anaAtCheckout,
  apiOrders,
  changesDialog,
  expectApiCart,
  expectCollectorFormIntact,
  openReview,
  pendingTitle,
  rejectedTitle,
  sendButton,
  trackOrderPosts,
} from './resilience-helpers'
import {
  apiOrder,
  cartRow,
  confirmButton,
  connectWallet,
  expectCheckoutTotal,
  orderIdFromUrl,
  receiptTitle,
  reviewDialog,
  setOrderSettleMs,
  toLineRef,
} from './shop-helpers'

/**
 * Falhas e idempotência no envio do pedido (docs/SPEC.md, "Pagamento e confirmação" e seção 6).
 * Todo REST passa pelos handlers MSW reais; cada teste começa do estado limpo (fixtures.ts) e
 * cria o próprio estado a partir do carrinho da Ana do seed (26.83 + 0.016 = 26.846).
 */

test.describe.configure({ timeout: 90_000 })

const ANA_LINES = ANA_CART.map(toLineRef)
const dialogAlert = (page: Page) => reviewDialog(page).getByRole('alert')
const retryButton = (page: Page) => reviewDialog(page).getByRole('button', { name: 'Tentar de novo' })

/** Espera a tela do pedido confirmado (recibo) e devolve o id da URL. */
async function expectReceipt(page: Page) {
  await expect(page).toHaveURL(/\/orders\/[^/]+$/)
  await expect(receiptTitle(page)).toBeVisible({ timeout: 20_000 })
  return orderIdFromUrl(page)
}

// ---------------------------------------------------------------------------
// 1. Pagamento recusado
// ---------------------------------------------------------------------------

test('1. pagamento recusado: pendente e recusa com o motivo da API, sem recibo; carrinho e formulário intactos; nova tentativa confirmada', async ({
  page,
  isMobile,
}) => {
  await signIn(page, 'ana')
  await setScenario(page, 'payment-rejected')
  const ordersBefore = (await apiOrders(page)).length
  await anaAtCheckout(page, isMobile)
  // Depois do último carregamento de página (a configuração dos mocks fica em memória).
  await setOrderSettleMs(page, 4_000)
  const posts = trackOrderPosts(page)

  await openReview(page)
  await sendButton(page).click()
  await expect(page).toHaveURL(/\/orders\/[^/]+$/)
  const rejectedId = orderIdFromUrl(page)
  await expect(pendingTitle(page)).toBeVisible()

  // Recusa com o motivo que a API gravou; nada de confirmação ou recibo.
  await expect(rejectedTitle(page)).toBeVisible({ timeout: 20_000 })
  const rejected = await apiOrder(page, rejectedId)
  expect(rejected.body.status).toBe('rejected')
  const reason = (rejected.body as unknown as { rejectionReason: string }).rejectionReason
  expect(reason).toBeTruthy()
  await expect(page.locator('p', { hasText: `Motivo: ${reason}` })).toBeVisible()
  await expect(receiptTitle(page)).toHaveCount(0)
  await expect(page.getByText('ID da transação')).toHaveCount(0)
  await expect(page.getByText(/pedido confirmado/i)).toHaveCount(0)
  await expectApiCart(page, ANA_LINES)

  // Terminal: recarregar mostra a mesma recusa; a API continua "rejected".
  await page.reload()
  await expect(rejectedTitle(page)).toBeVisible()
  expect((await apiOrder(page, rejectedId)).body.status).toBe('rejected')

  // "Voltar ao pagamento": checkout com o mesmo carrinho e o formulário como foi preenchido.
  await page.getByRole('link', { name: 'Voltar ao pagamento' }).click()
  await expect(page).toHaveURL(/\/checkout$/)
  await expectCheckoutTotal(page, isMobile, DESIGN_TOTALS.total)
  await expectCollectorFormIntact(page, isMobile)
  expect(posts.requests).toHaveLength(1)

  // Nova tentativa, agora confirmada: outro pedido, com outra chave.
  await setScenario(page, 'payment-confirmed')
  await setOrderSettleMs(page, 4_000)
  await page.getByRole('radio', { name: /^Principal/ }).check()
  await connectWallet(page)
  await openReview(page)
  await sendButton(page).click()
  await expect(page).toHaveURL(/\/orders\/[^/]+$/)
  const confirmedId = orderIdFromUrl(page)
  expect(confirmedId).not.toBe(rejectedId)
  await expect(pendingTitle(page)).toBeVisible()
  // Entra no carrinho durante o pendente: não faz parte da compra e precisa sobrar.
  const extra = PICKS[0]
  const added = await apiAs(page, 'POST', '/cart/items', {
    nftId: extra.nft.id,
    editionId: extra.edition.id,
    quantity: 1,
  })
  expect(added.status, JSON.stringify(added.body)).toBe(201)
  await expectReceipt(page)

  expect(posts.requests).toHaveLength(2)
  expect(posts.requests[0].key).not.toBe(posts.requests[1].key)
  const orders = await apiOrders(page)
  expect(orders).toHaveLength(ordersBefore + 2)
  expect(orders.find((o) => o.id === rejectedId)?.status).toBe('rejected')
  expect(orders.find((o) => o.id === confirmedId)?.status).toBe('confirmed')
  // O carrinho perdeu só o comprado.
  await expectApiCart(page, [{ nftId: extra.nft.id, editionId: extra.edition.id, quantity: 1 }])
})

// ---------------------------------------------------------------------------
// 2. Clique repetido
// ---------------------------------------------------------------------------

for (const variant of ['duplo clique', 'três cliques no mesmo quadro'] as const) {
  test(`2. clique repetido (${variant}) em "Enviar pedido": um único POST e um único pedido novo`, async ({
    page,
    isMobile,
  }) => {
    await signIn(page, 'ana')
    await setScenario(page, 'payment-confirmed')
    const ordersBefore = await apiOrders(page)
    await anaAtCheckout(page, isMobile)
    const posts = trackOrderPosts(page)

    await openReview(page)
    if (variant === 'duplo clique') {
      await sendButton(page).dblclick()
    } else {
      // Três cliques antes de o React renderizar de novo: só a guarda do envio impede o segundo.
      await sendButton(page).evaluate((button: HTMLButtonElement) => {
        button.click()
        button.click()
        button.click()
      })
    }
    const id = await expectReceipt(page)

    expect(posts.requests).toHaveLength(1)
    const ordersAfter = await apiOrders(page)
    expect(ordersAfter).toHaveLength(ordersBefore.length + 1)
    const created = ordersAfter.filter((o) => !ordersBefore.some((b) => b.id === o.id))
    expect(created.map((o) => o.id)).toEqual([id])
    expect(created[0].idempotencyKey).toBe(posts.requests[0].key)
  })
}

// ---------------------------------------------------------------------------
// 3. Timeout depois de criar o pedido
// ---------------------------------------------------------------------------

test('3. timeout após criar o pedido: "Verificando seu pedido...", reenvio com a mesma chave recupera o mesmo pedido', async ({
  page,
  isMobile,
}) => {
  await useClock(page)
  await signIn(page, 'ana')
  await setScenario(page, 'order-timeout')
  const ordersBefore = await apiOrders(page)
  await anaAtCheckout(page, isMobile)
  const posts = trackOrderPosts(page)

  await openReview(page)
  await sendButton(page).click()
  await expect.poll(() => posts.requests.length).toBe(1)
  await expect(reviewDialog(page).getByText('Enviando pedido…')).toBeVisible()

  // O servidor criou o pedido, mas a resposta não chega.
  await expect.poll(async () => (await apiOrders(page)).length).toBe(ordersBefore.length + 1)
  expect(posts.responses).toHaveLength(0)

  // Timeout do envio (10 s) pelo relógio falso: a tela passa a verificar o pedido.
  await page.clock.fastForward(10_500)
  await expect(reviewDialog(page).getByText('Verificando seu pedido...')).toBeVisible()
  // Backoff do reenvio.
  await page.clock.fastForward(1_500)
  await expect.poll(() => posts.requests.length).toBeGreaterThanOrEqual(2)
  await expect(page).toHaveURL(/\/orders\/[^/]+$/)
  const id = orderIdFromUrl(page)

  // Todos os envios usaram a mesma chave, e a API devolveu o mesmo pedido como repetição.
  const keys = new Set(posts.requests.map((r) => r.key))
  expect(keys.size).toBe(1)
  expect(posts.requests.every((r) => r.body.idempotencyKey === posts.requests[0].key)).toBe(true)
  await expect.poll(() => posts.responses.length).toBeGreaterThanOrEqual(1)
  const replay = posts.responses.find((r) => r.status === 200)
  expect(replay, JSON.stringify(posts.responses)).toBeDefined()
  expect(replay!.replayed).toBe('true')
  expect(replay!.body?.id).toBe(id)
  expect(posts.responses.some((r) => r.status === 201)).toBe(false)

  // Estado final, sem outra compra.
  await page.clock.fastForward(3_000)
  await expectReceipt(page)
  const ordersAfter = await apiOrders(page)
  expect(ordersAfter).toHaveLength(ordersBefore.length + 1)
  expect(ordersAfter.filter((o) => o.idempotencyKey === posts.requests[0].key).map((o) => o.id)).toEqual([id])
  expect(ordersAfter.find((o) => o.id === id)?.status).toBe('confirmed')
})

// ---------------------------------------------------------------------------
// 4. Idempotência na API
// ---------------------------------------------------------------------------

type PostResult = { status: number; replayed: string | null; body: { id?: string; code?: string; message?: string } }

/**
 * POST /api/orders com o token da Ana. Sai de dentro da página (fetch), não de page.request: o
 * MSW roda no navegador (service worker), e page.request vai direto ao servidor do Vite, que
 * responde o index.html (conferido ao escrever este teste).
 */
function postOrder(page: Page, key: string, body: Record<string, unknown>): Promise<PostResult> {
  return page.evaluate(
    async ([k, b, tokenKey]) => {
      const token = localStorage.getItem(tokenKey as string)!
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': k as string,
        },
        body: JSON.stringify({ ...(b as object), idempotencyKey: k }),
      })
      return {
        status: response.status,
        replayed: response.headers.get('Idempotent-Replayed'),
        body: (await response.json()) as PostResult['body'],
      }
    },
    [key, body, TOKEN_KEY] as const,
  )
}

test('4. idempotência na API: mesma chave e corpo devolvem o mesmo pedido; corpo diferente dá 409; chave nova cria outro', async ({
  page,
}) => {
  await signIn(page, 'ana')
  const pick = PICKS[0]
  const items = [{ nftId: pick.nft.id, editionId: pick.edition.id, quantity: 2 }]
  const wallet = (await apiAs<{ items: Record<string, string>[] }>(page, 'GET', '/wallets')).body.items.find(
    (w) => w.role === 'primary',
  )!
  const quote = async () => {
    const res = await apiAs<{ id: string }>(page, 'POST', '/quote', { items })
    expect(res.status).toBe(200)
    return res.body.id
  }
  const bodyFor = (quoteId: string) => ({
    quoteId,
    items,
    walletId: wallet.id,
    displayName: wallet.displayName,
    username: wallet.username,
    network: wallet.network,
    profileName: wallet.profileName,
    address: wallet.address,
    walletType: wallet.walletType,
    referralCode: wallet.referralCode,
    email: wallet.email,
    ensName: wallet.ensName,
  })
  const newKey = () => page.evaluate(() => crypto.randomUUID())
  const before = await apiOrders(page)

  const key = await newKey()
  const body = bodyFor(await quote())
  const first = await postOrder(page, key, body)
  expect(first.status, JSON.stringify(first.body)).toBe(201)
  expect(first.replayed).toBeNull()

  // Mesma chave, mesmo corpo: o mesmo pedido, marcado como repetição.
  const again = await postOrder(page, key, body)
  expect(again.status).toBe(200)
  expect(again.replayed).toBe('true')
  expect(again.body.id).toBe(first.body.id)

  // Mesma chave, corpo diferente: conflito, sem pedido novo.
  const conflict = await postOrder(page, key, { ...body, displayName: 'Outro Nome' })
  expect(conflict.status).toBe(409)
  expect(conflict.body.code).toBe('conflict')
  expect(conflict.body.id).toBeUndefined()
  expect(await apiOrders(page)).toHaveLength(before.length + 1)

  // Chave nova com o mesmo conteúdo: outro pedido. A cotação é de uso único (o primeiro pedido a
  // consumiu), então o mesmo conteúdo vai com uma cotação nova dos mesmos itens.
  const otherKey = await newKey()
  const second = await postOrder(page, otherKey, bodyFor(await quote()))
  expect(second.status, JSON.stringify(second.body)).toBe(201)
  expect(second.body.id).not.toBe(first.body.id)

  const after = await apiOrders(page)
  expect(after).toHaveLength(before.length + 2)
  expect(after.filter((o) => o.idempotencyKey === key).map((o) => o.id)).toEqual([first.body.id])
  expect(after.filter((o) => o.idempotencyKey === otherKey).map((o) => o.id)).toEqual([second.body.id])
})

// ---------------------------------------------------------------------------
// 5. Preço alterado no envio
// ---------------------------------------------------------------------------

test('5. preço alterado no envio: antes e depois em texto, nenhum pedido, só a nova confirmação envia (com chave nova)', async ({
  page,
  isMobile,
}) => {
  await signIn(page, 'ana')
  await setScenario(page, 'price-changed')
  const ordersBefore = await apiOrders(page)
  await anaAtCheckout(page, isMobile)
  const posts = trackOrderPosts(page)

  await openReview(page)
  await sendButton(page).click()
  await expect(changesDialog(page)).toBeVisible()
  await expect.poll(() => posts.responses.length).toBe(1)
  const conflict = posts.responses[0]
  expect(conflict.status).toBe(409)
  expect(conflict.body?.reason).toBe('price_changed')
  const fresh = conflict.body!.quote as {
    id: string
    total: string
    items: { nftId: string; editionId: string; unitPrice: string }[]
  }

  // O item que mudou: antes (preço do seed) e depois (preço da cotação nova), em texto.
  const changed = ANA_CART.find((l) => {
    const line = fresh.items.find((i) => i.nftId === l.nftId && i.editionId === l.editionId)!
    return !dec(line.unitPrice).eq(l.unitPrice)
  })!
  const newPrice = fresh.items.find((i) => i.nftId === changed.nftId)!.unitPrice
  expect(dec(newPrice).eq(dec(changed.unitPrice).mul('1.1'))).toBe(true)
  const dialog = changesDialog(page)
  const priceChange = dialog.getByRole('listitem').filter({ hasText: `${changed.name}: preço unitário` })
  await expect(priceChange).toContainText(`Antes: ${ethText(changed.unitPrice)}`)
  await expect(priceChange).toContainText(`Agora: ${ethText(newPrice)}`)
  const totalChange = dialog.getByRole('listitem').filter({ hasText: /^Total/ })
  await expect(totalChange).toContainText(`Antes: ${ethText(DESIGN_TOTALS.total)}`)
  await expect(totalChange).toContainText(`Agora: ${ethText(fresh.total)}`)
  await expect(dialog.getByText(`Novo total: ${ethText(fresh.total)}`)).toBeVisible()

  // Nenhum pedido foi criado e nada sai sem a nova confirmação.
  expect(await apiOrders(page)).toHaveLength(ordersBefore.length)
  expect(posts.requests).toHaveLength(1)
  await expect(sendButton(page)).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Confirmar novos valores' }).click()
  await expect.poll(() => posts.requests.length).toBe(2)
  const [firstPost, secondPost] = posts.requests
  expect(secondPost.key).not.toBe(firstPost.key)
  expect(secondPost.body.quoteId).toBe(fresh.id)
  const id = await expectReceipt(page)
  const ordersAfter = await apiOrders(page)
  expect(ordersAfter).toHaveLength(ordersBefore.length + 1)
  const order = ordersAfter.find((o) => o.id === id)!
  expect(order.idempotencyKey).toBe(secondPost.key)
  expect(dec(order.snapshot.total).eq(fresh.total)).toBe(true)
  expect(ordersAfter.some((o) => o.idempotencyKey === firstPost.key)).toBe(false)
})

// ---------------------------------------------------------------------------
// 6. Edição esgotada no envio
// ---------------------------------------------------------------------------

test('6. edição esgotada no envio: aviso claro, carrinho preservado, nenhum pedido e o item marcado em texto', async ({
  page,
  isMobile,
}) => {
  await signIn(page, 'ana')
  await setScenario(page, 'sold-out')
  const ordersBefore = await apiOrders(page)
  await anaAtCheckout(page, isMobile)
  const posts = trackOrderPosts(page)

  await openReview(page)
  await sendButton(page).click()
  const dialog = changesDialog(page)
  await expect(dialog).toBeVisible()
  await expect.poll(() => posts.responses.length).toBe(1)
  const conflict = posts.responses[0]
  expect(conflict.status).toBe(409)
  expect(conflict.body?.reason).toBe('sold_out')
  const affected = ANA_CART.find(
    (l) => l.nftId === conflict.body!.nftId && l.editionId === conflict.body!.editionId,
  )!
  expect(affected).toBeDefined()

  await expect(dialog.getByRole('alert')).toHaveText(
    'Um item ficou indisponível na quantidade pedida. Ajuste o carrinho para continuar.',
  )
  const stock = dialog.getByRole('listitem').filter({ hasText: `${affected.name}: disponibilidade` })
  await expect(stock).toContainText('Agora: Esgotado')
  await expect(dialog.getByRole('button', { name: 'Confirmar novos valores' })).toHaveCount(0)

  expect(await apiOrders(page)).toHaveLength(ordersBefore.length)
  expect(posts.requests).toHaveLength(1)
  await expectApiCart(page, ANA_LINES)

  // No carrinho, o item afetado fica marcado em texto; os outros seguem como estavam.
  await dialog.getByRole('link', { name: 'Ajustar carrinho' }).click()
  await expect(page).toHaveURL(/\/cart$/)
  await expect(cartRow(page, affected.name)).toContainText('Indisponível: esgotado')
  await expect(
    page.getByText(`${affected.name} está esgotado e o carrinho pede ${affected.quantity}.`, { exact: false }),
  ).toBeVisible()
  for (const other of ANA_CART.filter((l) => l !== affected)) {
    await expect(cartRow(page, other.name)).not.toContainText('Indisponível')
  }
  await expect(page.getByText('Ajuste ou remova os itens indisponíveis para continuar.')).toBeVisible()
  await expectApiCart(page, ANA_LINES)
})

// ---------------------------------------------------------------------------
// 7. Falha de servidor e de conexão no envio
// ---------------------------------------------------------------------------

test('7a. falha de servidor (server-error) no envio: "Tentar de novo", nada perdido, e ao normalizar um único pedido', async ({
  page,
  isMobile,
}) => {
  await signIn(page, 'ana')
  const ordersBefore = await apiOrders(page)
  await anaAtCheckout(page, isMobile)
  const posts = trackOrderPosts(page)
  // Uma falha (500) por rota: a conferência da cotação e o POST do pedido falham uma vez cada.
  await setScenario(page, 'server-error', { failures: 1 })

  await openReview(page)
  await sendButton(page).click()
  await expect(dialogAlert(page)).toBeVisible()
  if (posts.requests.length === 0) {
    // A conferência da cotação falhou antes do envio: nada saiu ainda.
    await expect(dialogAlert(page)).toContainText('Não foi possível conferir os valores antes do envio.')
    await expect(retryButton(page)).toBeVisible()
    await retryButton(page).click()
  }
  await expect(dialogAlert(page)).toContainText('O serviço está instável e o pedido não foi concluído.')
  await expect(dialogAlert(page)).toContainText('Seu carrinho e seus dados continuam salvos.')
  await expect(retryButton(page)).toBeVisible()
  expect(posts.requests).toHaveLength(1)
  expect(posts.responses.map((r) => r.status)).toEqual([500])
  await expectCollectorFormIntact(page, isMobile)

  // Cenário normalizado (só então a API é consultada, para não gastar a falha de cada rota):
  // nenhum pedido, carrinho intacto, e o reenvio (mesma chave) cria um único pedido.
  await setScenario(page, 'default')
  expect(await apiOrders(page)).toHaveLength(ordersBefore.length)
  await expectApiCart(page, ANA_LINES)
  await retryButton(page).click()
  const id = await expectReceipt(page)
  expect(posts.requests).toHaveLength(2)
  expect(posts.requests[1].key).toBe(posts.requests[0].key)
  const ordersAfter = await apiOrders(page)
  expect(ordersAfter).toHaveLength(ordersBefore.length + 1)
  expect(ordersAfter.find((o) => o.id === id)?.idempotencyKey).toBe(posts.requests[0].key)
})

test('7b. falha de conexão (offline) no envio: "Tentar de novo", nada perdido, e ao normalizar um único pedido', async ({
  page,
  isMobile,
}) => {
  await signIn(page, 'ana')
  const ordersBefore = await apiOrders(page)
  await anaAtCheckout(page, isMobile)
  const posts = trackOrderPosts(page)
  await setScenario(page, 'offline')

  await openReview(page)
  await sendButton(page).click()
  await expect(dialogAlert(page)).toContainText('Não foi possível conferir os valores antes do envio.')
  await expect(dialogAlert(page)).toContainText('Seu carrinho e seus dados continuam salvos.')
  await expect(retryButton(page)).toBeVisible()
  // Tentar de novo ainda sem conexão: o mesmo aviso, e nenhum pedido sai.
  await retryButton(page).click()
  await expect(dialogAlert(page)).toContainText('Não foi possível conferir os valores antes do envio.')
  await expect(retryButton(page)).toBeEnabled()
  expect(posts.requests).toHaveLength(0)
  await expectCollectorFormIntact(page, isMobile)

  await setScenario(page, 'default')
  await expectApiCart(page, ANA_LINES)
  expect(await apiOrders(page)).toHaveLength(ordersBefore.length)
  await retryButton(page).click()
  const id = await expectReceipt(page)
  expect(posts.requests).toHaveLength(1)
  const ordersAfter = await apiOrders(page)
  expect(ordersAfter).toHaveLength(ordersBefore.length + 1)
  expect(ordersAfter.find((o) => o.id === id)?.idempotencyKey).toBe(posts.requests[0].key)
})

// ---------------------------------------------------------------------------
// 8. Sessão expirada no envio
// ---------------------------------------------------------------------------

test('8. sessão expirada no envio: login com retorno ao checkout e retomada sem pedido duplicado', async ({
  page,
  isMobile,
}) => {
  const ANA = USERS.ana
  await signIn(page, 'ana')
  const ordersBefore = await apiOrders(page)
  await anaAtCheckout(page, isMobile)
  const posts = trackOrderPosts(page)
  // A 1ª chamada autenticada (conferir a cotação) passa; a 2ª (POST do pedido) expira a sessão.
  await setScenario(page, 'session-expired', { afterRequests: 1 })

  await openReview(page)
  await sendButton(page).click()
  await expectLoginRedirect(page, '/checkout')
  await expect(page.getByText('Sua sessão expirou. Entre novamente para continuar.')).toBeVisible()
  expect(posts.responses.every((r) => r.status === 401)).toBe(true)
  const sentBeforeLogin = posts.requests.length

  // Entra de novo: volta ao checkout com o rascunho; confirma e envia.
  await setScenario(page, 'default')
  await submitLoginForm(page, ANA.email, ANA.password)
  await expect(page).toHaveURL(/\/checkout$/)
  await expectCollectorFormIntact(page, isMobile)
  expect(await apiOrders(page)).toHaveLength(ordersBefore.length)
  await page.getByRole('radio', { name: /^Principal/ }).check()
  await connectWallet(page)
  await expect(confirmButton(page)).toBeEnabled()
  await openReview(page)
  await sendButton(page).click()
  const id = await expectReceipt(page)

  expect(posts.requests).toHaveLength(sentBeforeLogin + 1)
  const ordersAfter = await apiOrders(page)
  expect(ordersAfter).toHaveLength(ordersBefore.length + 1)
  const created = ordersAfter.filter((o) => !ordersBefore.some((b) => b.id === o.id))
  expect(created.map((o) => o.id)).toEqual([id])
  expect(new Decimal(created[0].snapshot.total).eq(DESIGN_TOTALS.total)).toBe(true)
  // Recarregar o recibo e abrir o checkout não cria nada.
  await page.reload()
  await expect(receiptTitle(page)).toBeVisible()
  await page.goto('/checkout')
  await expect(page).toHaveURL(/\/cart$/)
  expect(await apiOrders(page)).toHaveLength(ordersBefore.length + 1)
  expect(posts.requests).toHaveLength(sentBeforeLogin + 1)
})
