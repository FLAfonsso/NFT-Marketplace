import { Cart, type AddCartItemInput } from '@/contracts'
import { api } from '@/lib/api'

/** Visitante envia o id do carrinho; autenticado usa só o token (já no Axios). */
const guestHeaders = (guestId: string | null) =>
  guestId ? { 'X-Guest-Cart-Id': guestId } : undefined

export const cartApi = {
  get: (guestId: string | null, signal?: AbortSignal) =>
    api.get(Cart, '/cart', { signal, headers: guestHeaders(guestId) }),
  /** Soma à quantidade existente do par nftId + editionId. */
  addItem: (guestId: string | null, input: AddCartItemInput) =>
    api.post(Cart, '/cart/items', input, { headers: guestHeaders(guestId) }),
}
