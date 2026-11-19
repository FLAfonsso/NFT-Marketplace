import type { Page } from '@playwright/test'
import { createSeed } from '../src/mocks/db/seed'
import { apiAs } from './account-helpers'
import { ANA_CART, PICKS, WALLETS, COLLECTOR, type CartExpectation } from './data'
import { emitNftUpdate, expect } from './fixtures'
import {
  checkoutCta,
  checkoutField,
  confirmButton,
  ensureCollectorForm,
  prepareCheckout,
  reviewDialog,
} from './shop-helpers'

/**
 * Helpers dos testes de falhas, idempotência e tempo real (failures.spec.ts e realtime.spec.ts).
 * Tudo observa a interface, as requisições da página e a API simulada (handlers MSW reais);
 * nenhum helper mexe em cache, setter ou callback do app.
 */

// ---------------------------------------------------------------------------
// Pedidos (requisições e API)
// ---------------------------------------------------------------------------

export type OrderPost = { key: string | null; body: Record<string, unknown> }
export type OrderPostResponse = {
  status: number
  key: string | null
  replayed: string | null
  body: Record<string, unknown> | null
}

const isOrderCreate = (method: string, url: string) =>
  method === 'POST' && new URL(url).pathname === '/api/orders'

/**
 * Registra cada POST /api/orders da página (page.on('request')) com a Idempotency-Key e o corpo,
 * e cada resposta que chegar, com o cabeçalho Idempotent-Replayed.
 */
export function trackOrderPosts(page: Page) {
  const requests: OrderPost[] = []
  const responses: OrderPostResponse[] = []
  page.on('request', (request) => {
    if (!isOrderCreate(request.method(), request.url())) return
    requests.push({
      key: request.headers()['idempotency-key'] ?? null,
      body: (request.postDataJSON() as Record<string, unknown> | null) ?? {},
    })
  })
  page.on('response', async (response) => {
    const request = response.request()
    if (!isOrderCreate(request.method(), request.url())) return
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null
    responses.push({
      status: response.status(),
      key: request.headers()['idempotency-key'] ?? null,
      replayed: response.headers()['idempotent-replayed'] ?? null,
      body,
    })
  })
  return { requests, responses }
}

export type ApiOrder = {
  id: string
  idempotencyKey: string
  status: 'pending' | 'confirmed' | 'rejected'
  rejectionReason: string | null
  version: number
  snapshot: { total: string; items: { nftId: string; editionId: string; quantity: number }[] }
}

/** GET /api/orders do usuário logado. */
export async function apiOrders(page: Page): Promise<ApiOrder[]> {
  const res = await apiAs<{ items: ApiOrder[] }>(page, 'GET', '/orders')
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return res.body.items
}

export const sendButton = (page: Page) =>
  reviewDialog(page).getByRole('button', { name: 'Enviar pedido' })
export const changesDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'Os valores do pedido mudaram' })
export const pendingTitle = (page: Page) =>
  page.getByRole('heading', { name: 'Aguardando confirmação' })
export const rejectedTitle = (page: Page) =>
  page.getByRole('heading', { name: 'Pagamento recusado' })

/** Com a Ana logada: abre o checkout pelo carrinho, com formulário preenchido e carteira conectada. */
export async function anaAtCheckout(page: Page, isMobile: boolean) {
  await page.goto('/cart')
  await expect(page.getByRole('list', { name: 'Itens do carrinho' }).getByRole('listitem')).toHaveCount(
    ANA_CART.length,
  )
  await checkoutCta(page).click()
  await expect(page).toHaveURL(/\/checkout$/)
  return prepareCheckout(page, isMobile, 'ana')
}

/** "Confirmar compra" e espera a revisão aberta. */
export async function openReview(page: Page) {
  await confirmButton(page).click()
  await expect(reviewDialog(page)).toBeVisible()
}

/** Formulário do colecionador com os valores preenchidos pelo teste (rascunho intacto). */
export async function expectCollectorFormIntact(page: Page, isMobile: boolean) {
  await ensureCollectorForm(page, isMobile)
  const wallet = WALLETS.ana
  await expect(checkoutField(page, 'Nome de exibição')).toHaveValue(COLLECTOR.displayName)
  await expect(checkoutField(page, 'Nome de usuário')).toHaveValue(COLLECTOR.username)
  await expect(checkoutField(page, 'Nome do perfil')).toHaveValue(COLLECTOR.profileName)
  await expect(checkoutField(page, 'Endereço da carteira')).toHaveValue(wallet.address)
  await expect(checkoutField(page, 'Código de indicação')).toHaveValue(COLLECTOR.referralCode)
  await expect(checkoutField(page, 'E-mail')).toHaveValue(COLLECTOR.email)
  await expect(checkoutField(page, 'Nome ENS')).toHaveValue(COLLECTOR.ensLabel)
  await expect(page.getByLabel('Observação do colecionador (opcional)')).toHaveValue(COLLECTOR.note)
}

/** Itens do carrinho na API iguais aos esperados (nft, edição e quantidade). */
export async function expectApiCart(page: Page, lines: readonly Pick<CartExpectation, 'nftId' | 'editionId' | 'quantity'>[]) {
  const res = await apiAs<{ items: { nftId: string; editionId: string; quantity: number }[] }>(page, 'GET', '/cart')
  expect(res.status).toBe(200)
  const norm = (items: readonly { nftId: string; editionId: string; quantity: number }[]) =>
    items
      .map(({ nftId, editionId, quantity }) => `${nftId}:${editionId}:${quantity}`)
      .sort()
  expect(norm(res.body.items)).toEqual(norm(lines))
}

// ---------------------------------------------------------------------------
// Página e regiões ao vivo
// ---------------------------------------------------------------------------

/** Marca a página; expectSamePage falha se ela foi recarregada desde então. */
export const markPage = (page: Page) =>
  page.evaluate(() => {
    ;(window as unknown as { __e2eMark?: boolean }).__e2eMark = true
  })
export const expectSamePage = async (page: Page) =>
  expect(await page.evaluate(() => (window as unknown as { __e2eMark?: boolean }).__e2eMark === true)).toBe(
    true,
  )

/**
 * Grava, a partir de agora, cada texto que as regiões ao vivo (role="status", role="alert",
 * aria-live) passam a ter. Serve para contar anúncios: um anúncio é a passagem de uma região de
 * "não contém o texto" para "contém o texto".
 */
export const recordLiveRegions = (page: Page) =>
  page.evaluate(() => {
    const log: { region: number; text: string }[] = []
    const ids = new WeakMap<Element, number>()
    const last = new Map<number, string>()
    let next = 0
    const snapshot = () => {
      for (const el of document.querySelectorAll('[role="status"],[role="alert"],[aria-live]')) {
        if (el.getAttribute('aria-live') === 'off') continue
        let id = ids.get(el)
        if (id === undefined) {
          id = next++
          ids.set(el, id)
        }
        const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
        if (last.get(id) !== text) {
          last.set(id, text)
          log.push({ region: id, text })
        }
      }
    }
    snapshot()
    new MutationObserver(snapshot).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['role', 'aria-live', 'hidden'],
    })
    ;(window as unknown as { __e2eLive?: typeof log }).__e2eLive = log
  })

/** Quantas vezes alguma região ao vivo passou a conter `text` desde recordLiveRegions. */
export const announcements = (page: Page, text: string) =>
  page.evaluate((t) => {
    const log = (window as unknown as { __e2eLive?: { region: number; text: string }[] }).__e2eLive ?? []
    const had = new Map<number, boolean>()
    let count = 0
    for (const { region, text } of log) {
      const has = text.includes(t)
      if (has && !had.get(region)) count++
      had.set(region, has)
    }
    return count
  }, text)

/** Algum texto já anunciado contém `text`? */
export const everAnnounced = async (page: Page, text: string) => (await announcements(page, text)) > 0

// ---------------------------------------------------------------------------
// Tempo real
// ---------------------------------------------------------------------------

export type SocketCount = { nftUpdated: number; orderUpdated: number; total: number; connected: boolean }
export type RealtimeDiagnostics = {
  status: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
  guest: boolean | null
  current: SocketCount | null
  previous: SocketCount[]
  screenSubscriptions: { 'nft.updated': number; 'order.updated': number }
  trackedResources: number
}

/** Diagnóstico do cliente de tempo real do app (window.__realtime, só leitura). */
export const diagnostics = (page: Page) =>
  page.evaluate(() => window.__realtime!.diagnostics() as RealtimeDiagnostics)

/** Texto do indicador de conexão (região role="status" do layout). */
export const INDICATOR = {
  reconnecting: 'Reconectando… as atualizações em tempo real voltam em instantes.',
  disconnected: 'Sem atualizações em tempo real.',
  restored: 'Conexão restabelecida.',
} as const
export const indicator = (page: Page, text: string) =>
  page.getByRole('status').filter({ hasText: text })
/** Conectado: o indicador não mostra nada (nenhum dos três textos na tela). */
export async function expectIndicatorQuiet(page: Page) {
  for (const text of Object.values(INDICATOR)) await expect(page.getByText(text)).toHaveCount(0)
}

/** Avança o relógio falso até o socket do app reconectar (backoff do socket.io-client). */
export async function advanceUntilConnected(page: Page) {
  await expect
    .poll(
      async () => {
        await page.clock.fastForward(1_000)
        return (await diagnostics(page)).status
      },
      { timeout: 30_000, intervals: [100] },
    )
    .toBe('connected')
}

/**
 * NFTs "sentinela" (fora do carrinho da Ana e das compras dos testes), um por chamada de
 * flushEvents: o evento dele chega pelo mesmo socket, depois dos anteriores, então quando ele é
 * aceito (o controle de versão passa a ter mais um recurso) todos os anteriores já foram tratados.
 */
const seed = createSeed()
const busy = new Set([...ANA_CART.map((l) => l.nftId), ...PICKS.map((p) => p.nft.id)])
const SENTINELS = seed.nfts.filter((n) => !busy.has(n.id)).map((n) => n.id).reverse()
let sentinelIndex = 0

export async function flushEvents(page: Page) {
  const nftId = SENTINELS[sentinelIndex++ % SENTINELS.length]
  const before = (await diagnostics(page)).trackedResources
  await emitNftUpdate(page, { nftId, price: '7.77' })
  await expect.poll(async () => (await diagnostics(page)).trackedResources).toBe(before + 1)
}
