import axios from 'axios'
import {
  Order,
  OrderConflict,
  OrderList,
  Profile,
  WalletConnection,
  WalletList,
  type CreateOrderInput,
  type WalletType,
} from '@/contracts'
import { api, isApiRequestError } from '@/lib/api'

/** Timeout do envio do pedido: menor que o padrão do Axios, para a recuperação começar logo. */
export const ORDER_TIMEOUT_MS = 10_000

export const checkoutApi = {
  profile: (signal?: AbortSignal) => api.get(Profile, '/profile', { signal }),
  wallets: (signal?: AbortSignal) => api.get(WalletList, '/wallets', { signal }),

  /** Conexão simulada da carteira cadastrada com o provedor escolhido. Recusa: 403. */
  connectWallet: (walletId: string, provider: WalletType, signal?: AbortSignal) =>
    api.post(
      WalletConnection,
      `/wallets/${encodeURIComponent(walletId)}/connect`,
      { provider },
      { signal },
    ),

  /**
   * POST /orders idempotente: a chave vai no cabeçalho e no corpo. Mesma chave e mesmo corpo
   * devolvem o mesmo pedido (200, Idempotent-Replayed); corpo diferente com a mesma chave, 409.
   */
  createOrder: (input: CreateOrderInput) =>
    api.post(Order, '/orders', input, {
      headers: { 'Idempotency-Key': input.idempotencyKey },
      timeout: ORDER_TIMEOUT_MS,
    }),

  order: (id: string, signal?: AbortSignal) =>
    api.get(Order, `/orders/${encodeURIComponent(id)}`, { signal }),
  orders: (signal?: AbortSignal) => api.get(OrderList, '/orders', { signal }),
}

/**
 * Corpo tipado do 409 de POST /orders (preço alterado, esgotado), validado pelo contrato.
 * null para os demais erros, inclusive 409 simples (chave reutilizada, cotação vencida).
 */
export function orderConflictOf(error: unknown): OrderConflict | null {
  const cause = isApiRequestError(error) ? error.cause : null
  if (!axios.isAxiosError(cause) || cause.response?.status !== 409) return null
  const parsed = OrderConflict.safeParse(cause.response.data)
  return parsed.success ? parsed.data : null
}

/** 409 de chave de idempotência reutilizada com outro conteúdo (ApiError simples). */
export const isKeyConflict = (error: unknown) =>
  isApiRequestError(error) &&
  error.code === 'conflict' &&
  orderConflictOf(error) === null &&
  /idempot/i.test(error.message)
