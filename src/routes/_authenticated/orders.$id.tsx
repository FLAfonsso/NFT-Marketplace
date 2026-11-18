import { createFileRoute } from '@tanstack/react-router'
import { PageSkeleton } from '@/components/PageSkeleton'

export const Route = createFileRoute('/_authenticated/orders/$id')({
  component: OrderConfirmationPage,
})

function OrderConfirmationPage() {
  return <PageSkeleton title="Confirmação do pedido" />
}
