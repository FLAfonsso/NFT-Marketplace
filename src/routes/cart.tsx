import { createFileRoute } from '@tanstack/react-router'
import { PageSkeleton } from '@/components/PageSkeleton'

export const Route = createFileRoute('/cart')({
  component: CartPage,
})

function CartPage() {
  return <PageSkeleton title="Carrinho" />
}
