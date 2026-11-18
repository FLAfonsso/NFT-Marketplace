import type { QueryClient } from '@tanstack/react-query'
import type { Order } from '@/contracts'
import { attemptStorage, pendingOrderStorage } from '@/features/checkout/storage'
import { queryKeys } from '@/lib/queryKeys'

/**
 * Pedido ficou confirmado ou recusado (estado terminal):
 * - esquece o id do pedido pendente e a chave de idempotência, mas só se forem DESTE pedido
 *   (abrir um pedido antigo não pode apagar um envio novo em andamento);
 * - invalida carrinho (itens comprados saem dele) e catálogo (estoque baixou ou voltou).
 *   Só marca como velho: quem estiver montado relê, e o resto relê na próxima abertura.
 */
export function settleTerminalOrder(queryClient: QueryClient, userId: string, order: Order) {
  if (pendingOrderStorage.load(userId) === order.id) pendingOrderStorage.clear(userId)
  if (attemptStorage.load(userId)?.key === order.idempotencyKey) attemptStorage.clear(userId)

  void queryClient.invalidateQueries({ queryKey: queryKeys.cart({ userId }) })
  void queryClient.invalidateQueries({ queryKey: queryKeys.nfts.all })
  // A lista de pedidos, sem reler o próprio pedido que está na tela.
  void queryClient.invalidateQueries({
    queryKey: queryKeys.orders.all(userId),
    refetchType: 'none',
  })
}
