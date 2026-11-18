import { http, HttpResponse } from 'msw'
import {
  QuoteRequest,
  type Quote,
  type QuoteCoupon,
  type QuoteLine,
  type QuoteWarning,
} from '@/contracts'
import { mockSettings } from '../settings'
import { nextId, transact, type TxContext } from '../db/store'
import type { CartKey, CouponRecord, DbState } from '../db/types'
import { Eth, networkFeeFor, toEthString } from '../db/util'
import { API, fail, parseBody, resolveActor, route } from './utils'

const evaluateCoupon = (
  code: string,
  coupon: CouponRecord | undefined,
  subtotal: Eth,
  now: string,
): { coupon: QuoteCoupon; discount: Eth } => {
  if (!coupon) {
    return { coupon: { code, status: 'invalid', message: 'Cupom inexistente.' }, discount: new Eth(0) }
  }
  if (Date.parse(coupon.expiresAt) <= Date.parse(now)) {
    return { coupon: { code, status: 'expired', message: 'Cupom expirado.' }, discount: new Eth(0) }
  }
  let discount =
    coupon.kind === 'percent' ? subtotal.mul(coupon.value).div(100) : new Eth(coupon.value)
  if (coupon.maxDiscount) discount = Eth.min(discount, coupon.maxDiscount)
  // Desconto nunca maior que o subtotal.
  discount = Eth.min(discount, subtotal)
  return { coupon: { code, status: 'applied' }, discount }
}

/**
 * Emite e guarda uma cotação dentro de uma transação aberta. Usada por POST /quote e por
 * POST /orders, que reemite a cotação quando o preço mudou desde a revisão.
 */
export const createQuote = (
  db: DbState,
  tx: TxContext,
  actorKey: CartKey,
  input: QuoteRequest,
): Quote => {
  const seen = new Set<string>()
  const lines: QuoteLine[] = []
  const warnings: QuoteWarning[] = []
  const lastPrices = (db.lastQuotedPrices[actorKey] ??= {})

  input.items.forEach((item, index) => {
    const key = `${item.nftId}:${item.editionId}`
    if (seen.has(key)) {
      fail('validation', 'Item repetido na cotação.', { [`items.${index}`]: ['Item repetido'] })
    }
    seen.add(key)

    const nft = db.nfts.find((n) => n.id === item.nftId)
    const edition = nft?.editions.find((e) => e.id === item.editionId)
    if (!nft || !edition) {
      return fail('not_found', 'Item da cotação não encontrado.', {
        [`items.${index}`]: ['NFT ou edição inexistente'],
      })
    }
    if (item.quantity > edition.maxPerOrder) {
      fail('validation', `Limite de ${edition.maxPerOrder} unidade(s) por pedido.`, {
        [`items.${index}.quantity`]: [`Máximo de ${edition.maxPerOrder}`],
      })
    }

    if (edition.available < item.quantity) {
      warnings.push({
        type: 'unavailable',
        nftId: nft.id,
        editionId: edition.id,
        requested: item.quantity,
        available: edition.available,
      })
    }
    const previous = lastPrices[key]
    if (previous && !new Eth(previous).eq(nft.price)) {
      warnings.push({
        type: 'price_changed',
        nftId: nft.id,
        editionId: edition.id,
        previousPrice: previous,
        currentPrice: nft.price,
      })
    }
    lastPrices[key] = nft.price

    lines.push({
      nftId: nft.id,
      editionId: edition.id,
      quantity: item.quantity,
      unitPrice: nft.price,
      lineTotal: toEthString(new Eth(nft.price).mul(item.quantity)),
      nftVersion: nft.version,
    })
  })

  const subtotal = lines.reduce((sum, l) => sum.add(l.lineTotal), new Eth(0))
  const couponResult = input.couponCode
    ? evaluateCoupon(
        input.couponCode,
        db.coupons.find((c) => c.code === input.couponCode),
        subtotal,
        tx.now,
      )
    : null
  const discount = couponResult?.discount ?? new Eth(0)
  const networkFee = networkFeeFor(lines.length)

  // Descarta cotações vencidas antes de guardar a nova.
  for (const [id, record] of Object.entries(db.quotes)) {
    if (Date.parse(record.quote.expiresAt) <= Date.parse(tx.now)) delete db.quotes[id]
  }

  const quote: Quote = {
    id: nextId(db, 'qte'),
    items: lines,
    coupon: couponResult?.coupon ?? null,
    subtotal: toEthString(subtotal),
    discount: toEthString(discount),
    networkFee: toEthString(networkFee),
    total: toEthString(subtotal.sub(discount).add(networkFee)),
    warnings,
    createdAt: tx.now,
    expiresAt: new Date(Date.parse(tx.now) + mockSettings.quoteTtlMs).toISOString(),
  }
  db.quotes[quote.id] = {
    quote,
    actor: actorKey,
    requestedCoupon: input.couponCode ?? null,
  }
  return quote
}

export const quoteHandlers = [
  http.post(
    `${API}/quote`,
    route(async ({ request }) => {
      const actor = resolveActor(request)
      const input = await parseBody(request, QuoteRequest)
      const quote = transact((db, tx) => createQuote(db, tx, actor.key, input))
      return HttpResponse.json(quote)
    }),
  ),
]
