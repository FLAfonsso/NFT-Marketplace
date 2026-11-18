import { createFileRoute } from '@tanstack/react-router'
import { PageSkeleton } from '@/components/PageSkeleton'

export const Route = createFileRoute('/_authenticated/checkout')({
  component: CheckoutPage,
})

function CheckoutPage() {
  return <PageSkeleton title="Pagamento" />
}
