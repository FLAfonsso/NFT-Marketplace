import { useState } from 'react'
import type { OrderStatus } from '@/contracts'
import { useAuth } from '@/features/auth'
import { useOrderStatus } from '../useOrderStatus'
import { OrderDeniedView, OrderLoadError, OrderSkeleton } from './OrderStates'
import { PendingView } from './PendingView'
import { ReceiptView } from './ReceiptView'
import { RejectedView } from './RejectedView'

const ANNOUNCEMENTS: Partial<Record<OrderStatus, string>> = {
  confirmed: 'Pedido confirmado. Seus NFTs agora estão na sua carteira.',
  rejected: 'Pagamento recusado. Seus itens continuam no carrinho.',
}

/** Confirmação do pedido (/orders/$id, privada). A chave remonta tudo ao trocar de usuário ou pedido. */
export function OrderPage({ orderId }: { orderId: string }) {
  const auth = useAuth()
  if (auth.status !== 'authenticated') return null
  return <OrderScreen key={`${auth.user.id}:${orderId}`} userId={auth.user.id} orderId={orderId} />
}

function OrderScreen({ userId, orderId }: { userId: string; orderId: string }) {
  const { order, denied, error, isLoading, refetch } = useOrderStatus(userId, orderId)
  const status = order?.status ?? null

  // Anúncio da mudança de estado: só quando o pedido sai de pendente para um estado terminal
  // (a região já existe na tela, então o leitor de tela lê a troca de texto).
  const [seen, setSeen] = useState<OrderStatus | null>(null)
  const [announcement, setAnnouncement] = useState('')
  if (status !== seen) {
    setSeen(status)
    if (seen === 'pending' && status) setAnnouncement(ANNOUNCEMENTS[status] ?? '')
  }

  let view
  if (denied) view = <OrderDeniedView />
  else if (!order) {
    view = isLoading ? <OrderSkeleton /> : <OrderLoadError onRetry={() => void refetch()} />
  } else if (order.status === 'confirmed') view = <ReceiptView order={order} />
  else if (order.status === 'rejected') view = <RejectedView order={order} />
  else view = <PendingView orderId={order.id} connectionError={error !== null} onRetry={() => void refetch()} />

  return (
    <>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {view}
    </>
  )
}
