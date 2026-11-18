import Decimal from 'decimal.js'
import type { Quote, QuoteCoupon } from '@/contracts'
import { formatEth } from '@/lib/eth'

/** Uma diferença entre a cotação revisada e a nova, em texto (antes e depois). */
export interface QuoteChange {
  id: string
  label: string
  before: string
  after: string
}

const lineKey = (line: { nftId: string; editionId: string }) => `${line.nftId}:${line.editionId}`
const eth = (value: string) => `${formatEth(value)} ETH`
const differs = (a: string, b: string) => !new Decimal(a).eq(b)

const couponText = (coupon: QuoteCoupon | null) => {
  if (!coupon) return 'Sem cupom'
  const status =
    coupon.status === 'applied' ? 'aplicado' : coupon.status === 'expired' ? 'expirado' : 'inválido'
  return `${coupon.code} ${status}`
}

/**
 * Compara a cotação revisada pelo usuário com uma nova: preço e quantidade de cada item,
 * disponibilidade (avisos "unavailable"), cupom, desconto, taxa de rede, subtotal e total.
 * Contas com decimal.js; nenhuma diferença quer dizer que a cotação revisada continua valendo.
 */
export function diffQuotes(
  before: Quote,
  after: Quote,
  nameOf: (line: { nftId: string; editionId: string }) => string,
): QuoteChange[] {
  const changes: QuoteChange[] = []
  const afterLines = new Map(after.items.map((line) => [lineKey(line), line]))

  for (const line of before.items) {
    const key = lineKey(line)
    const next = afterLines.get(key)
    const name = nameOf(line)
    if (!next) {
      changes.push({ id: `${key}:removed`, label: name, before: `${line.quantity} un.`, after: 'Fora do pedido' })
      continue
    }
    if (differs(line.unitPrice, next.unitPrice)) {
      changes.push({
        id: `${key}:price`,
        label: `${name}: preço unitário`,
        before: eth(line.unitPrice),
        after: eth(next.unitPrice),
      })
    }
    if (line.quantity !== next.quantity) {
      changes.push({
        id: `${key}:quantity`,
        label: `${name}: quantidade`,
        before: String(line.quantity),
        after: String(next.quantity),
      })
    }
  }

  const beforeKeys = new Set(before.items.map(lineKey))
  for (const line of after.items) {
    if (!beforeKeys.has(lineKey(line))) {
      changes.push({
        id: `${lineKey(line)}:added`,
        label: nameOf(line),
        before: 'Fora do pedido',
        after: `${line.quantity} un.`,
      })
    }
  }

  const unavailableBefore = new Set(
    before.warnings.filter((w) => w.type === 'unavailable').map(lineKey),
  )
  for (const warning of after.warnings) {
    if (warning.type !== 'unavailable' || unavailableBefore.has(lineKey(warning))) continue
    changes.push({
      id: `${lineKey(warning)}:stock`,
      label: `${nameOf(warning)}: disponibilidade`,
      before: 'Disponível',
      after:
        warning.available === 0
          ? 'Esgotado'
          : `Só ${warning.available} disponível(is) para ${warning.requested} pedido(s)`,
    })
  }

  if (couponText(before.coupon) !== couponText(after.coupon)) {
    changes.push({
      id: 'coupon',
      label: 'Cupom',
      before: couponText(before.coupon),
      after: couponText(after.coupon),
    })
  }

  const totals = [
    ['subtotal', 'Subtotal'],
    ['discount', 'Desconto'],
    ['networkFee', 'Taxa de rede'],
    ['total', 'Total'],
  ] as const
  for (const [field, label] of totals) {
    if (differs(before[field], after[field])) {
      changes.push({ id: field, label, before: eth(before[field]), after: eth(after[field]) })
    }
  }

  return changes
}

/** A nova cotação não pode virar pedido (item esgotado ou acima do disponível). */
export const isBlockingQuote = (quote: Quote) => quote.warnings.some((w) => w.type === 'unavailable')
