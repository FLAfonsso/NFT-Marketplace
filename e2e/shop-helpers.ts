import type { Locator, Page } from '@playwright/test'
import Decimal from 'decimal.js'
import { apiAs, countRequests, exactLabel, openCollectorForm } from './account-helpers'
import {
  COLLECTOR,
  ethText,
  fmtEth,
  type CartExpectation,
  type Purchase,
  type SeedNft,
  WALLETS,
} from './data'
import { expect } from './fixtures'

/**
 * Helpers de carrinho, checkout e recibo. Seletores por papel e texto acessível; onde a
 * semântica não oferece alternativa (pares <dt>/<dd>) o helper localiza o <dd> irmão do <dt>.
 */

// ---------------------------------------------------------------------------
// Valores
// ---------------------------------------------------------------------------

/** Primeiro "x.xx ETH" de um texto, como Decimal. */
export function readEth(text: string): Decimal {
  const match = /(\d+(?:\.\d+)?)\s*ETH/.exec(text)
  if (!match) throw new Error(`Sem valor em ETH em "${text}"`)
  return new Decimal(match[1])
}

/** <dd> irmão do <dt> com o rótulo dado, dentro de `scope`. */
export const ddOf = (scope: Locator, label: string | RegExp, nth: 'first' | 'last' = 'first') => {
  const dt = scope.locator('dt', {
    hasText: typeof label === 'string' ? new RegExp(`^${label}$`) : label,
  })
  return (nth === 'first' ? dt.first() : dt.last()).locator('xpath=following-sibling::dd[1]')
}

export type Totals = { subtotal: string; discount: string; networkFee: string; total: string }

// ---------------------------------------------------------------------------
// Cabeçalho / badge
// ---------------------------------------------------------------------------

export const cartLink = (page: Page) => page.getByRole('link', { name: /^Carrinho(,|$)/ })

/** No mobile a seção do formulário é recolhível: só expande se estiver recolhida. */
export async function ensureCollectorForm(page: Page, isMobile: boolean) {
  const note = page.getByLabel('Observação do colecionador (opcional)')
  if (isMobile && (await note.isHidden())) {
    await page.getByRole('button', { name: /^Dados do colecionador/ }).click()
  }
  await expect(note).toBeVisible()
}

/**
 * Badge do carrinho: soma das quantidades (não de linhas). O nome acessível do link traz o número.
 * No mobile, detalhe do NFT, carrinho e pagamento não têm a barra inferior (têm painel próprio);
 * ali o número é lido em outra aba, na página inicial, sem mexer na tela em teste.
 */
export async function expectBadge(page: Page, count: number) {
  const name = `Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`
  const { mobile, path } = await page.evaluate(() => ({
    mobile: matchMedia('(max-width: 767px)').matches,
    path: location.pathname,
  }))
  if (mobile && /^\/(cart|checkout|nft\/)/.test(path)) {
    const other = await page.context().newPage()
    try {
      await other.goto('/')
      await expect(cartLink(other)).toHaveAccessibleName(name)
    } finally {
      await other.close()
    }
    return
  }
  await expect(cartLink(page)).toHaveAccessibleName(name)
  // O desktop também mostra o número no badge visual do header.
  if (!mobile) await expect(page.getByTestId('cart-badge')).toHaveText(String(count))
}

// ---------------------------------------------------------------------------
// Carrinho (/cart)
// ---------------------------------------------------------------------------

export const cartList = (page: Page) => page.getByRole('list', { name: 'Itens do carrinho' })
export const cartRow = (page: Page, name: string) =>
  cartList(page).getByRole('listitem').filter({ hasText: name })
export const cartSummary = (page: Page) =>
  page.getByRole('complementary', { name: 'Resumo da carteira' })
export const summaryValue = (page: Page, label: string) => ddOf(cartSummary(page), label)

export const stepperOf = (row: Locator) => row.getByRole('group', { name: 'Quantidade' })
export const quantityOf = (row: Locator) => stepperOf(row).locator('output')
export const plusOf = (row: Locator) => row.getByRole('button', { name: 'Aumentar quantidade' })
export const minusOf = (row: Locator) => row.getByRole('button', { name: 'Diminuir quantidade' })
export const trashOf = (page: Page, name: string) =>
  page.getByRole('button', { name: `Remover ${name} do carrinho` })
export const checkoutCta = (page: Page) =>
  page.getByRole('link', { name: 'Conectar e finalizar' })
export const couponInput = (page: Page) => page.getByLabel('Código promocional')
export const removeCouponButton = (page: Page) =>
  page.getByRole('button', { name: 'Remover cupom' })

/** Espera o resumo da tela mostrar exatamente os valores (a cotação da API substitui o anterior). */
export async function expectCartSummary(page: Page, totals: Totals) {
  await expect(summaryValue(page, 'Subtotal')).toHaveText(ethText(totals.subtotal))
  await expect(summaryValue(page, 'Desconto do lançamento')).toHaveText(
    `(-) ${ethText(totals.discount)}`,
  )
  await expect(summaryValue(page, 'Taxa de rede')).toHaveText(ethText(totals.networkFee))
  await expect(summaryValue(page, 'Total')).toHaveText(ethText(totals.total))
}

/** Itens do carrinho: nome, edição, quantidade e total da linha. */
export async function expectCartRows(page: Page, lines: readonly CartExpectation[]) {
  await expect(cartList(page).getByRole('listitem')).toHaveCount(lines.length)
  for (const line of lines) {
    const row = cartRow(page, line.name)
    await expect(row).toHaveCount(1)
    await expect(row).toContainText(`Edição: ${line.editionName}`)
    await expect(quantityOf(row)).toHaveText(String(line.quantity))
    await expect(row).toContainText(`Total: ${ethText(line.lineTotal)}`)
  }
}

/** Resumo lido da tela, em Decimal. */
export async function readCartSummary(page: Page) {
  const read = async (label: string) => readEth((await summaryValue(page, label).innerText()).trim())
  return {
    subtotal: await read('Subtotal'),
    discount: await read('Desconto do lançamento'),
    networkFee: await read('Taxa de rede'),
    total: await read('Total'),
  }
}

type QuoteBody = Totals & { items: { nftId: string; editionId: string; quantity: number; lineTotal: string }[] }

/**
 * POST /api/quote com o mesmo token da sessão. O MSW roda no service worker do navegador; por
 * isso a chamada sai de dentro da página (fetch), não de page.request (ver relatório).
 */
export async function apiQuote(
  page: Page,
  lines: readonly { nftId: string; editionId: string; quantity: number }[],
  couponCode?: string,
) {
  const res = await apiAs<QuoteBody>(page, 'POST', '/quote', {
    items: lines.map(({ nftId, editionId, quantity }) => ({ nftId, editionId, quantity })),
    ...(couponCode ? { couponCode } : {}),
  })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return res.body
}

export const toLineRef = (l: CartExpectation) => ({
  nftId: l.nftId,
  editionId: l.editionId,
  quantity: l.quantity,
})

export async function apiCart(page: Page) {
  const res = await apiAs<{
    items: { nftId: string; editionId: string; quantity: number }[]
    couponCode: string | null
  }>(page, 'GET', '/cart')
  expect(res.status).toBe(200)
  return res.body
}

// ---------------------------------------------------------------------------
// Adicionar ao carrinho
// ---------------------------------------------------------------------------

const isCartAdd = (r: { url(): string; request(): { method(): string } }) =>
  r.url().includes('/cart/items') && r.request().method() === 'POST'

/** Na tela do NFT: escolhe a edição e a quantidade (o detalhe já deve estar aberto). */
export async function chooseOnDetail(page: Page, { nft, edition, quantity }: Purchase) {
  await expect(page.getByRole('heading', { level: 1, name: nft.name })).toBeVisible()
  // O radio é visualmente oculto (sr-only); o clique vai no rótulo da edição, como o do usuário.
  await page.getByRole('radiogroup', { name: 'Edição:' }).getByText(edition.name, { exact: true }).click()
  await expect(page.getByRole('radio', { name: edition.name, exact: true })).toBeChecked()
  const group = page.getByRole('group', { name: 'Quantidade' })
  for (let i = 1; i < quantity; i++) await group.getByRole('button', { name: 'Aumentar quantidade' }).click()
  await expect(group.locator('output')).toHaveText(String(quantity))
}

/** COMPRAR (desktop) / "Comprar NFT" (mobile): adiciona e vai ao /cart. */
export async function buyOnDetail(page: Page) {
  const added = page.waitForResponse(isCartAdd)
  await page.getByRole('button', { name: /^Comprar/ }).click()
  expect((await added).status()).toBe(201)
  await expect(page).toHaveURL(/\/cart$/)
}

/** Detalhe do NFT (acesso direto): edição, quantidade e COMPRAR. Termina em /cart. */
export async function addFromDetail(page: Page, pick: Purchase) {
  await page.goto(`/nft/${pick.nft.id}`)
  await chooseOnDetail(page, pick)
  await buyOnDetail(page)
}

/** Card do catálogo: ícone de carrinho (adiciona 1 unidade da primeira edição disponível). */
export async function addFromCard(page: Page, nft: SeedNft) {
  await page.goto(`/?q=${encodeURIComponent(nft.name)}`)
  const card = page
    .getByRole('region', { name: 'Catálogo de NFTs' })
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: `Ver ${nft.name}` }) })
  const added = page.waitForResponse(isCartAdd)
  await card.getByRole('button', { name: `Adicionar ${nft.name} ao carrinho` }).click()
  expect((await added).status()).toBe(201)
  const edition = nft.editions.find((e) => e.available > 0)!
  await expect(page.getByText(`${nft.name} (edição ${edition.name}) adicionado ao carrinho.`)).toBeVisible()
  return edition
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/** Quanto o pedido pendente demora para ser liquidado (deixa o estado "pendente" observável). */
export const setOrderSettleMs = (page: Page, ms: number) =>
  page.evaluate((value) => window.__mocks!.configure({ orderSettleMs: value }), ms)

// ---------------------------------------------------------------------------
// Checkout (/checkout)
// ---------------------------------------------------------------------------

export const checkoutField = (page: Page, label: string) => page.getByLabel(exactLabel(label))
export const confirmButton = (page: Page) => page.getByRole('button', { name: 'Confirmar compra' })
export const reviewDialog = (page: Page) => page.getByRole('dialog', { name: 'Revise seu pedido' })
export const orderItems = (page: Page) => page.getByRole('list', { name: 'Itens do pedido' })
export const orderSection = (page: Page) => page.getByRole('region', { name: 'Seus NFTs' })

/** Abre /checkout pela URL e espera o formulário ser pré-preenchido. */
export async function gotoCheckout(page: Page, isMobile: boolean) {
  await page.goto('/checkout')
  await openCollectorForm(page, isMobile)
  await expect(checkoutField(page, 'E-mail')).not.toHaveValue('')
}

/** Preenche o formulário do colecionador com valores válidos (o endereço é o da carteira). */
export async function fillCollectorForm(
  page: Page,
  wallet: { address: string; network: string; walletType: string },
  values: Partial<typeof COLLECTOR> = {},
) {
  const v = { ...COLLECTOR, ...values }
  await checkoutField(page, 'Nome de exibição').fill(v.displayName)
  await checkoutField(page, 'Nome de usuário').fill(v.username)
  await checkoutField(page, 'Rede').selectOption(wallet.network)
  await checkoutField(page, 'Nome do perfil').fill(v.profileName)
  await checkoutField(page, 'Endereço da carteira').fill(wallet.address)
  await checkoutField(page, 'Tipo de carteira').selectOption(wallet.walletType)
  await checkoutField(page, 'Código de indicação').fill(v.referralCode)
  await checkoutField(page, 'E-mail').fill(v.email)
  await checkoutField(page, 'Nome ENS').fill(v.ensLabel)
  await page.getByLabel('Observação do colecionador (opcional)').fill(v.note)
}

/** Escolhe a carteira cadastrada (preenche endereço, rede e tipo com os dela). */
export async function chooseWallet(page: Page, nickname: string) {
  const radio = page.getByRole('radio', { name: new RegExp(`^${nickname}`) })
  await radio.check()
  await expect(radio).toBeChecked()
  const card = radio.locator('xpath=ancestor::label')
  const text = await card.innerText()
  return {
    nickname,
    short: /0x[0-9a-f]{4}…[0-9a-f]{4}/i.exec(text)![0],
    network: /Rede (.+)$/m.exec(text)![1].trim(),
  }
}

export async function connectWallet(page: Page) {
  const connected = page.waitForResponse(
    (r) => /\/wallets\/[^/]+\/connect$/.test(r.url()) && r.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  expect((await connected).status()).toBe(200)
  await expect(page.getByText(/^Conectada:/)).toBeVisible()
}

export type OrderLine = { name: string; quantity: number; amount: string }
export type OrderView = {
  items: OrderLine[]
  subtotal: string
  networkFee: string
  total: string
}

/** Resumo "Seus NFTs" do checkout (valores como a interface mostra, em Decimal-string). */
export async function readCheckoutSummary(page: Page, isMobile: boolean): Promise<OrderView> {
  const lis = orderItems(page).getByRole('listitem')
  await expect(lis.first()).toBeVisible()
  const items: OrderLine[] = []
  for (const li of await lis.all()) {
    items.push({
      name: (await li.locator('p').first().innerText()).trim(),
      quantity: Number(/Quantidade (\d+)/.exec(await li.innerText())?.[1] ?? /\(x (\d+)\)/.exec(await li.innerText())![1]),
      amount: readEth(await li.getByText(/^\d+(\.\d+)? ETH$/).innerText()).toFixed(),
    })
  }
  const section = orderSection(page)
  const read = async (label: string) => readEth(await ddOf(section, label).innerText()).toFixed()
  // No mobile a linha Total do resumo fica oculta; o total é o do painel fixo com o botão.
  const total = isMobile
    ? readEth(await page.locator('p', { hasText: /^Total:/ }).innerText()).toFixed()
    : await read('Total')
  return { items, subtotal: await read('Subtotal'), networkFee: await read('Taxa de rede'), total }
}

/** Espera o resumo do checkout estabilizar com o total esperado (a cotação chegou). */
export async function expectCheckoutTotal(page: Page, isMobile: boolean, total: string) {
  if (isMobile) {
    await expect(page.locator('p', { hasText: /^Total:/ })).toContainText(ethText(total))
  } else {
    await expect(ddOf(orderSection(page), 'Total')).toHaveText(ethText(total))
  }
}

/** Revisão: itens, carteira e total iguais ao resumo; devolve nada, só confere. */
export async function expectReviewMatches(
  page: Page,
  summary: OrderView,
  wallet: { nickname: string; short: string; network: string },
) {
  const dialog = reviewDialog(page)
  await expect(dialog).toBeVisible()
  const lis = dialog.getByRole('region', { name: 'Itens' }).getByRole('listitem')
  await expect(lis).toHaveCount(summary.items.length)
  for (const [i, item] of summary.items.entries()) {
    const text = (await lis.nth(i).innerText()).replace(/\s+/g, ' ')
    expect(text).toContain(`${item.name} (x ${item.quantity})`)
    expect(readEth(text).eq(item.amount), `${item.name}: ${text}`).toBe(true)
  }
  const carteira = await ddOf(dialog, 'Carteira').innerText()
  expect(carteira).toContain(wallet.nickname)
  expect(carteira).toContain(wallet.short)
  await expect(ddOf(dialog, 'Rede')).toHaveText(wallet.network)
  expect(readEth(await ddOf(dialog, 'Subtotal').innerText()).eq(summary.subtotal)).toBe(true)
  expect(readEth(await ddOf(dialog, 'Taxa de rede').innerText()).eq(summary.networkFee)).toBe(true)
  expect(readEth(await ddOf(dialog, 'Total').innerText()).eq(summary.total)).toBe(true)
}

// ---------------------------------------------------------------------------
// Recibo (/orders/:id)
// ---------------------------------------------------------------------------

export const receiptTitle = (page: Page) =>
  page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })

export type Receipt = OrderView & { txShort: string; txHash: string; date: string; wallet: string }

/** Lê o recibo da tela (diálogo no desktop, página no mobile). */
export async function readReceipt(page: Page): Promise<Receipt> {
  await expect(receiptTitle(page)).toBeVisible()
  const tx = ddOf(page.locator('body'), 'ID da transação')
  const rows = page.getByRole('table').locator('tbody tr')
  const items: OrderLine[] = []
  for (const row of await rows.all()) {
    const text = await row.innerText()
    items.push({
      name: (await row.locator('p').first().innerText()).trim(),
      quantity: Number(/Quantidade (\d+)/.exec(text)?.[1] ?? /\(x (\d+)\)/.exec(text)![1]),
      amount: readEth(await row.locator('td').last().innerText()).toFixed(),
    })
  }
  const body = page.locator('body')
  return {
    items,
    // O recibo só mostra "Subtotal" quando há desconto; sem desconto vale a soma das linhas.
    subtotal: items.reduce((sum, i) => sum.add(i.amount), new Decimal(0)).toFixed(),
    networkFee: readEth(await ddOf(body, 'Taxa de rede').innerText()).toFixed(),
    total: readEth(await ddOf(body, 'Total', 'last').innerText()).toFixed(),
    txShort: (await tx.innerText()).trim(),
    txHash: (await tx.locator('span').getAttribute('title')) ?? '',
    date: (await ddOf(body, 'Data').innerText()).trim(),
    wallet: (await ddOf(body, 'Carteira').innerText()).replace(/\s+/g, ' ').trim(),
  }
}

/** Mesma formatação de data do recibo ("29 Jul, 2026"), para comparar com o updatedAt da API. */
export function receiptDate(iso: string): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).formatToParts(new Date(iso))
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  const month = get('month').replace('.', '')
  return `${get('day')} ${month.charAt(0).toUpperCase()}${month.slice(1)}, ${get('year')}`
}

export const shortHash = (hash: string) => `${hash.slice(0, 6)}…${hash.slice(-4)}`

export const orderIdFromUrl = (page: Page) => new URL(page.url()).pathname.split('/').pop()!

export async function apiOrder(page: Page, id: string) {
  return apiAs<{
    id: string
    status: string
    updatedAt: string
    transactionRef: { hash: string } | null
    snapshot: { total: string; networkFee: string; items: { lineTotal: string; quantity: number }[] }
  }>(page, 'GET', `/orders/${id}`)
}

// ---------------------------------------------------------------------------
// Fluxo completo de compra (checkout → recibo)
// ---------------------------------------------------------------------------

export type PaidOrder = {
  id: string
  before: OrderView
  wallet: { nickname: string; short: string; network: string }
  receipt: Receipt
}

/** Com o /checkout aberto: formulário, carteira cadastrada e conexão simulada. */
export async function prepareCheckout(
  page: Page,
  isMobile: boolean,
  walletOf: 'ana' | 'bruno',
  nickname = 'Principal',
) {
  await openCollectorForm(page, isMobile)
  await expect(checkoutField(page, 'E-mail')).not.toHaveValue('')
  const walletData = WALLETS[walletOf]
  await fillCollectorForm(page, walletData)
  const wallet = await chooseWallet(page, nickname)
  // Escolher a carteira reaplica endereço, rede e tipo dela (o pedido exige que coincidam).
  await expect(checkoutField(page, 'Endereço da carteira')).toHaveValue(walletData.address)
  await connectWallet(page)
  await expect(confirmButton(page)).toBeEnabled()
  return wallet
}

/** "Confirmar compra", revisão e "Enviar pedido"; devolve o resumo de antes e, no fim, o recibo. */
export async function sendOrder(
  page: Page,
  isMobile: boolean,
  wallet: { nickname: string; short: string; network: string },
  onPending?: (id: string) => Promise<void>,
): Promise<PaidOrder> {
  const before = await readCheckoutSummary(page, isMobile)
  await confirmButton(page).click()
  await expectReviewMatches(page, before, wallet)

  const created = page.waitForResponse(
    (r) => r.url().endsWith('/orders') && r.request().method() === 'POST',
  )
  await reviewDialog(page).getByRole('button', { name: 'Enviar pedido' }).click()
  expect((await created).status()).toBe(201)
  await expect(page).toHaveURL(/\/orders\/[^/]+$/)
  const id = orderIdFromUrl(page)

  await expect(page.getByRole('heading', { name: 'Aguardando confirmação' })).toBeVisible()
  await expect(receiptTitle(page)).toHaveCount(0)
  expect((await apiOrder(page, id)).body.status).toBe('pending')
  await onPending?.(id)

  await expect(receiptTitle(page)).toBeVisible({ timeout: 15_000 })
  const receipt = await readReceipt(page)
  return { id, before, wallet, receipt }
}

/** A partir do /cart com itens: finalizar, formulário, carteira, revisão, envio e recibo. */
export async function payFromCart(
  page: Page,
  isMobile: boolean,
  walletOf: 'ana' | 'bruno',
  options: { nickname?: string; onPending?: (id: string) => Promise<void> } = {},
): Promise<PaidOrder> {
  await setOrderSettleMs(page, 4_000)
  await checkoutCta(page).click()
  await expect(page).toHaveURL(/\/checkout$/)
  const wallet = await prepareCheckout(page, isMobile, walletOf, options.nickname)
  return sendOrder(page, isMobile, wallet, options.onPending)
}

/** O recibo mostra o mesmo que o resumo mostrava antes de enviar, e o que a API gravou. */
export async function expectReceiptMatches(page: Page, paid: PaidOrder) {
  const { before, receipt, wallet, id } = paid
  expect(receipt.items.map((i) => i.name)).toEqual(before.items.map((i) => i.name))
  for (const [i, item] of before.items.entries()) {
    expect(receipt.items[i].quantity, item.name).toBe(item.quantity)
    expect(new Decimal(receipt.items[i].amount).eq(item.amount), `${item.name} subtotal`).toBe(true)
  }
  expect(new Decimal(receipt.subtotal).eq(before.subtotal)).toBe(true)
  expect(new Decimal(receipt.networkFee).eq(before.networkFee)).toBe(true)
  expect(new Decimal(receipt.total).eq(before.total)).toBe(true)
  expect(receipt.wallet).toContain(wallet.short)
  expect(receipt.wallet).toContain(wallet.network)

  const api = await apiOrder(page, id)
  expect(api.body.status).toBe('confirmed')
  expect(api.body.transactionRef?.hash).toBeTruthy()
  expect(receipt.txHash).toBe(api.body.transactionRef!.hash)
  expect(receipt.txShort).toBe(shortHash(api.body.transactionRef!.hash))
  expect(receipt.date).toBe(receiptDate(api.body.updatedAt))
}

export { countRequests, fmtEth }
