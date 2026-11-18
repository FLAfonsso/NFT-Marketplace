import { createFileRoute } from '@tanstack/react-router'
import { CartPage } from '@/features/cart/components/CartPage'

/** Pública: visitante e usuário autenticado têm carrinho. */
export const Route = createFileRoute('/cart')({
  component: CartPage,
})
