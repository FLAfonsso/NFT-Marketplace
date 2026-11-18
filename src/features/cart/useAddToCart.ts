import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AddCartItemInput } from '@/contracts'
import { queryKeys } from '@/lib/queryKeys'
import { cartApi } from './cartApi'
import { useCartOwner } from './useCart'

/** Adiciona uma edição ao carrinho (soma à quantidade existente) e atualiza o cache. */
export function useAddToCart() {
  const owner = useCartOwner()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: AddCartItemInput) => {
      if (!owner) throw new Error('Sessão em recuperação. Tente de novo em instantes.')
      return cartApi.addItem('guestId' in owner ? owner.guestId : null, input)
    },
    onSuccess: (cart) => {
      if (owner) queryClient.setQueryData(queryKeys.cart(owner), cart)
    },
  })
}
