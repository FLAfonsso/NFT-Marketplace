import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { isTerminalOrderStatus } from '@/contracts'
import { checkoutApi } from '@/features/checkout/checkoutApi'
import { onSyncedEvent } from '@/features/realtime/bus'
import { useSocketStatus } from '@/features/realtime/socket'
import { isApiRequestError } from '@/lib/api'
import { queryKeys } from '@/lib/queryKeys'
import { settleTerminalOrder } from './settleOrder'

/**
 * Intervalo da releitura (fallback) enquanto o pedido está pendente e o tempo real não está
 * conectado. Conectado, quem atualiza é o `order.updated`.
 */
export const ORDER_POLL_MS = 5_000

/** 404 e 403 recebem o mesmo tratamento: a tela não revela se o pedido existe. */
export const isOrderAccessError = (error: unknown) =>
  isApiRequestError(error) && (error.code === 'not_found' || error.code === 'forbidden')

/**
 * Estado do pedido (GET /orders/:id), a única fonte de verdade da tela de confirmação.
 *
 * - Chave por usuário e id; o AbortSignal do Query cancela respostas obsoletas.
 * - Tempo real: `order.updated` (já filtrado por usuário, duplicata e version em
 *   useRealtimeSync) atualiza o cache desta chave com setQueryData. Se o evento chega antes da
 *   primeira leitura, a query é relida pela API.
 * - Pendente sem tempo real conectado (queda, reconexão): relê a cada ORDER_POLL_MS como
 *   fallback. Ao reconectar, a reconciliação relê o pedido. Confirmado e recusado são
 *   terminais: o pedido não é mais relido sozinho. Também para se a API negou o acesso.
 * - Retoma ao voltar a rede e o foco da aba ('always': mesmo com dado recente).
 * - Falha de rede com o pedido já em tela mantém o último estado e segue tentando.
 */
export function useOrderStatus(userId: string, orderId: string) {
  const queryClient = useQueryClient()
  const realtime = useSocketStatus()
  const key = queryKeys.orders.detail(userId, orderId)

  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => checkoutApi.order(orderId, signal),
    staleTime: 0,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    refetchInterval: (q) => {
      if (isOrderAccessError(q.state.error) || realtime === 'connected') return false
      const order = q.state.data
      return order && !isTerminalOrderStatus(order.status) ? ORDER_POLL_MS : false
    },
  })

  useEffect(
    () =>
      onSyncedEvent('order.updated', ({ event }) => {
        if (event.resource.id !== orderId || event.userId !== userId) return
        // O cache já foi atualizado; sem dado ainda (primeira leitura em voo), relê pela API.
        if (!queryClient.getQueryData(queryKeys.orders.detail(userId, orderId))) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(userId, orderId) })
        }
      }),
    [queryClient, userId, orderId],
  )

  const order = query.data
  const pending = order?.status === 'pending'

  // Conectou (primeira vez ou de novo) com o pedido pendente: um evento pode ter saído antes,
  // sem conexão para recebê-lo. Relê uma vez pela API; dali em diante o evento basta.
  const { refetch } = query
  useEffect(() => {
    if (realtime === 'connected' && pending) void refetch()
  }, [realtime, pending, refetch])

  // Efeitos do estado terminal, uma vez por pedido e status.
  const settled = useRef<string | null>(null)
  useEffect(() => {
    if (!order || !isTerminalOrderStatus(order.status)) return
    const mark = `${order.id}:${order.status}`
    if (settled.current === mark) return
    settled.current = mark
    settleTerminalOrder(queryClient, userId, order)
  }, [order, queryClient, userId])

  return {
    order,
    /** Pedido inexistente ou de outro usuário. */
    denied: isOrderAccessError(query.error),
    /** Falha ao ler. Com `order` definido, é uma releitura que falhou (o estado em tela é o último). */
    error: query.isError && !isOrderAccessError(query.error) ? query.error : null,
    isLoading: query.isPending,
    refetch: query.refetch,
  }
}
