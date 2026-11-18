import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CouponCode, type Cart } from '@/contracts'
import { queryKeys } from '@/lib/queryKeys'
import { cartApi, guestIdOf } from './cartApi'
import { useCartOwner } from './useCart'
import { toQuoteRequest } from './useQuote'

/**
 * Aplicar e remover o cupom do carrinho.
 * A API guarda qualquer código e só a cotação diz se vale. Por isso aplicar primeiro cota com o
 * código e só o guarda se a cotação o aceita; recusas viram erro do campo (mensagem da API).
 * Remover reverte: o carrinho volta sem cupom e a cotação sem código é a de antes.
 */
export function useCoupon(cart: Cart) {
  const owner = useCartOwner()
  const queryClient = useQueryClient()

  const apply = useMutation({
    mutationFn: async (raw: string) => {
      if (!owner) throw new Error('Sessão em recuperação. Tente de novo em instantes.')
      const parsed = CouponCode.safeParse(raw)
      if (!parsed.success) throw new Error('Digite o código promocional.')
      const request = toQuoteRequest(cart.items, parsed.data)
      if (!request) throw new Error('Adicione um item ao carrinho para usar um cupom.')

      const quote = await cartApi.quote(guestIdOf(owner), request)
      if (quote.coupon?.status !== 'applied') {
        throw new Error(
          quote.coupon?.message ??
            (quote.coupon?.status === 'expired' ? 'Cupom expirado.' : 'Cupom inválido.'),
        )
      }
      const updated = await cartApi.setCoupon(guestIdOf(owner), parsed.data)
      return { cart: updated, quote, request }
    },
    onSuccess: ({ cart: updated, quote, request }) => {
      if (!owner) return
      queryClient.setQueryData(queryKeys.cart(owner), updated)
      // A cotação que validou o cupom já é a do carrinho com ele: evita uma segunda chamada.
      queryClient.setQueryData(queryKeys.cartQuote(owner, request), quote)
    },
  })

  const remove = useMutation({
    mutationFn: () => {
      if (!owner) throw new Error('Sessão em recuperação. Tente de novo em instantes.')
      return cartApi.setCoupon(guestIdOf(owner), null)
    },
    onSuccess: (updated) => {
      if (owner) queryClient.setQueryData(queryKeys.cart(owner), updated)
    },
  })

  return { apply, remove }
}
