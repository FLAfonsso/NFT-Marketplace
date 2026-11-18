import type { Order } from '@/contracts'
import { isApiRequestError } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import { queryKeys } from '@/lib/queryKeys'
import { checkoutApi } from './checkoutApi'
import { forgetOrderAttempt, pendingOrderStorage } from './storage'

/**
 * Pedido terminou (confirmado ou recusado): apaga a chave e o pendente e atualiza o que mudou
 * na API (o carrinho perde os itens comprados; o estoque reservado volta na recusa).
 */
export function settleOrderLocally(userId: string, order: Order) {
  forgetOrderAttempt(userId)
  queryClient.setQueryData(queryKeys.orders.detail(userId, order.id), order)
  void queryClient.invalidateQueries({ queryKey: queryKeys.cart({ userId }) })
  void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all(userId) })
}

/**
 * Ao abrir /checkout: devolve o id do pedido pendente guardado para este usuário, se ainda
 * estiver pendente. Pedido já liquidado (ou que não existe mais) é esquecido. Falha de rede
 * mantém o pendente: na dúvida, o usuário vai para o pedido, não para um novo envio.
 */
export async function resolvePendingOrder(userId: string): Promise<string | null> {
  const orderId = pendingOrderStorage.load(userId)
  if (!orderId) return null
  try {
    const order = await queryClient.fetchQuery({
      queryKey: queryKeys.orders.detail(userId, orderId),
      queryFn: ({ signal }) => checkoutApi.order(orderId, signal),
      staleTime: 0,
    })
    if (order.status === 'pending') return orderId
    settleOrderLocally(userId, order)
    return null
  } catch (error) {
    if (isApiRequestError(error) && (error.code === 'not_found' || error.code === 'forbidden')) {
      pendingOrderStorage.clear(userId)
      return null
    }
    return orderId
  }
}
