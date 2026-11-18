import Decimal from 'decimal.js'
import type { CreateOrderInput } from '@/contracts'
import type { ReviewSnapshot } from './machine'
import { attemptStorage, type OrderAttempt } from './storage'

/** JSON com chaves ordenadas: o mesmo conteúdo sempre dá o mesmo texto. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** cyrb53: hash rápido e estável (não criptográfico), suficiente para comparar conteúdos. */
function cyrb53(text: string, seed = 0) {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0')
}

const norm = (eth: string) => new Decimal(eth).toFixed()

/**
 * Hash do conteúdo do pedido: itens, quantidades, cupom, carteira e valores da cotação.
 * O id da cotação fica de fora: revalidar sem mudança de valores mantém a mesma chave.
 */
export function contentHash(review: ReviewSnapshot): string {
  const { quote } = review
  return cyrb53(
    stableStringify({
      items: [...review.items]
        .map(({ nftId, editionId, quantity }) => ({ nftId, editionId, quantity }))
        .sort((a, b) => `${a.nftId}:${a.editionId}`.localeCompare(`${b.nftId}:${b.editionId}`)),
      couponCode: review.couponCode,
      wallet: { id: review.wallet.id, address: review.wallet.address.toLowerCase(), network: review.network },
      quote: {
        lines: quote.items.map((l) => [l.nftId, l.editionId, l.quantity, norm(l.unitPrice)]),
        coupon: quote.coupon ? [quote.coupon.code, quote.coupon.status] : null,
        subtotal: norm(quote.subtotal),
        discount: norm(quote.discount),
        networkFee: norm(quote.networkFee),
        total: norm(quote.total),
      },
    }),
  )
}

export function buildOrderInput(review: ReviewSnapshot, key: string): CreateOrderInput {
  return {
    ...review.form,
    idempotencyKey: key,
    quoteId: review.quote.id,
    items: review.items.map(({ nftId, editionId, quantity }) => ({ nftId, editionId, quantity })),
    ...(review.couponCode ? { couponCode: review.couponCode } : {}),
    walletId: review.wallet.id,
  }
}

/**
 * Tentativa a enviar para a revisão confirmada.
 * - Mesmo conteúdo da tentativa guardada: mesma chave. Se o último envio ficou sem resposta,
 *   reenvia exatamente o mesmo corpo; senão, o corpo novo (cotação recém-conferida).
 * - Conteúdo diferente (já confirmado pelo usuário) ou chave recusada: chave nova.
 * A tentativa é gravada como "incerta" antes de sair: um refresh no meio retoma a verificação.
 */
export function prepareAttempt(userId: string, review: ReviewSnapshot): OrderAttempt {
  const hash = contentHash(review)
  const stored = attemptStorage.load(userId)
  const reuse = stored && stored.hash === hash && !stored.conflict
  const key = reuse ? stored.key : crypto.randomUUID()
  const input = reuse && stored.uncertain ? stored.input : buildOrderInput(review, key)
  const attempt: OrderAttempt = { key, hash, input, uncertain: true }
  attemptStorage.save(userId, attempt)
  return attempt
}
