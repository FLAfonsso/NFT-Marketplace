import { Cart } from '@/contracts'
import { api } from '@/lib/api'

export const cartApi = {
  /** Visitante envia o id do carrinho; autenticado usa só o token (já no Axios). */
  get: (guestId: string | null, signal?: AbortSignal) =>
    api.get(Cart, '/cart', {
      signal,
      headers: guestId ? { 'X-Guest-Cart-Id': guestId } : undefined,
    }),
}
