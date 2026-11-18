import { createFileRoute } from '@tanstack/react-router'
import { OrderPage } from '@/features/orders'

export const Route = createFileRoute('/_authenticated/orders/$id')({
  component: OrderRoute,
})

function OrderRoute() {
  const { id } = Route.useParams()
  return <OrderPage orderId={id} />
}
