import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { isTerminalOrderStatus } from '@/contracts'
import { checkoutApi } from '@/features/checkout/checkoutApi'
import { isApiRequestError } from '@/lib/api'
import { queryKeys } from '@/lib/queryKeys'
import { settleTerminalOrder } from './settleOrder'

/** Intervalo da releitura enquanto o pedido está pendente. */
export const ORDER_POLL_MS = 2_000

/** 404 e 403 recebem o mesmo tratamento: a tela não revela se o pedido existe. */
export const isOrderAccessError = (error: unknown) =>
  isApiRequestError(error) && (error.code === 'not_found' || error.code === 'forbidden')

/**
 * Estado do pedido (GET /orders/:id), a única fonte de verdade da tela de confirmação.
 *
 * - Chave por usuário e id; o AbortSignal do Query cancela respostas obsoletas.
 * - Pendente: relê a cada ORDER_POLL_MS. Confirmado e recusado são terminais: o intervalo para
 *   e o pedido não é mais relido sozinho. Também para se a API negou o acesso.
 * - Retoma ao reconectar e ao voltar o foco da aba ('always': mesmo com dado recente).
 * - Falha de rede com o pedido já em tela mantém o último estado e segue tentando.
 *
 * PONTO DO TEMPO REAL: ao ligar `order.updated`, assine aqui com `onRealtimeEvent` (efeito
 * dependente de userId e orderId), ignore eventos de outro usuário, `version` <= à do cache e
 * `id` repetido, e atualize com `queryClient.setQueryData(<mesma chave>, ...)` (ou só
 * `invalidateQueries`, que relê pela API). O polling vira fallback e a tela não muda: ela só
 * consome o que este hook devolve.
 */
export function useOrderStatus(userId: string, orderId: string) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.orders.detail(userId, orderId),
    queryFn: ({ signal }) => checkoutApi.order(orderId, signal),
    staleTime: 0,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    refetchInterval: (q) => {
      if (isOrderAccessError(q.state.error)) return false
      const order = q.state.data
      return order && !isTerminalOrderStatus(order.status) ? ORDER_POLL_MS : false
    },
  })

  const order = query.data

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
