import { createFileRoute, redirect } from '@tanstack/react-router'
import { CheckoutPage } from '@/features/checkout/components/CheckoutPage'
import { resolvePendingOrder } from '@/features/checkout/pendingOrder'

export const Route = createFileRoute('/_authenticated/checkout')({
  // Pedido pendente guardado para este usuário: o checkout leva até ele em vez de abrir outro.
  beforeLoad: async ({ context }) => {
    const session = await context.session.whenReady()
    if (session.status !== 'authenticated') return
    const pendingId = await resolvePendingOrder(session.user.id)
    if (pendingId) throw redirect({ to: '/orders/$id', params: { id: pendingId }, replace: true })
  },
  component: CheckoutPage,
})
