import {
  Cart,
  Quote,
  type AddCartItemInput,
  type QuoteRequest,
  type UpdateCartItemInput,
} from '@/contracts'
import { api } from '@/lib/api'
import type { CartOwner } from '@/lib/queryKeys'

/** Visitante envia o id do carrinho; autenticado usa só o token (já no Axios). */
const guestHeaders = (guestId: string | null) =>
  guestId ? { 'X-Guest-Cart-Id': guestId } : undefined

/** Id de visitante do dono do carrinho, ou null para usuário autenticado. */
export const guestIdOf = (owner: CartOwner) => ('guestId' in owner ? owner.guestId : null)

export const cartApi = {
  get: (guestId: string | null, signal?: AbortSignal) =>
    api.get(Cart, '/cart', { signal, headers: guestHeaders(guestId) }),
  /** Soma à quantidade existente do par nftId + editionId. */
  addItem: (guestId: string | null, input: AddCartItemInput) =>
    api.post(Cart, '/cart/items', input, { headers: guestHeaders(guestId) }),
  /** Define a quantidade (valor final, não incremento) de um item existente. */
  updateItem: (guestId: string | null, input: UpdateCartItemInput) =>
    api.patch(Cart, '/cart/items', input, { headers: guestHeaders(guestId) }),
  /** Idempotente: remover item ausente devolve o carrinho atual. */
  removeItem: (guestId: string | null, nftId: string, editionId: string) =>
    api.delete(
      Cart,
      `/cart/items/${encodeURIComponent(nftId)}/${encodeURIComponent(editionId)}`,
      { headers: guestHeaders(guestId) },
    ),
  /** Guarda (ou remove, com null) o cupom do carrinho. A validade só aparece na cotação. */
  setCoupon: (guestId: string | null, couponCode: string | null) =>
    api.put(Cart, '/cart/coupon', { couponCode }, { headers: guestHeaders(guestId) }),
  /** Cotação: referência de subtotal, desconto, taxa e total. */
  quote: (guestId: string | null, request: QuoteRequest, signal?: AbortSignal) =>
    api.post(Quote, '/quote', request, { signal, headers: guestHeaders(guestId) }),
}
