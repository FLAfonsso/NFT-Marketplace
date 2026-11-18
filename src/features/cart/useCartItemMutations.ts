import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { Cart, CartItem } from '@/contracts'
import { isApiRequestError } from '@/lib/api'
import { queryKeys, type CartOwner } from '@/lib/queryKeys'
import { cartApi, guestIdOf } from './cartApi'
import { useCartOwner } from './useCart'

const MUTATION_KEY = ['cart', 'items'] as const

type ItemRef = Pick<CartItem, 'nftId' | 'editionId'>

const isSame = (a: ItemRef, b: ItemRef) => a.nftId === b.nftId && a.editionId === b.editionId

const withQuantity = (cart: Cart, item: CartItem): Cart => ({
  ...cart,
  items: cart.items.map((i) => (isSame(i, item) ? { ...i, quantity: item.quantity } : i)),
})

/**
 * Relê o carrinho da API quando a última mutation de item termina. Com várias em voo, a releitura
 * espera a última, para não sobrescrever uma atualização otimista de outro item.
 */
const settle = (queryClient: QueryClient, owner: CartOwner) => {
  if (queryClient.isMutating({ mutationKey: MUTATION_KEY }) <= 1) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.cart(owner), exact: true })
  }
}

/** Estoque mudou (409): o detalhe do NFT, que traz as edições, precisa ser relido. */
const refreshStockOnConflict = (queryClient: QueryClient, error: unknown, nftId: string) => {
  if (isApiRequestError(error) && error.status === 409) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.nfts.detail(nftId) })
  }
}

/**
 * Altera a quantidade de um item. Atualização otimista no cache do carrinho; se a API recusar,
 * volta só a quantidade deste item (os demais ficam como estão). Cada linha do carrinho usa a
 * própria instância, então o estado pendente e o erro são por item.
 */
export function useUpdateQuantity() {
  const owner = useCartOwner()
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: MUTATION_KEY,
    mutationFn: (input: CartItem) => {
      if (!owner) throw new Error('Sessão em recuperação. Tente de novo em instantes.')
      return cartApi.updateItem(guestIdOf(owner), input)
    },
    onMutate: async (input) => {
      if (!owner) return { previous: undefined }
      const key = queryKeys.cart(owner)
      await queryClient.cancelQueries({ queryKey: key, exact: true })
      const previous = queryClient
        .getQueryData<Cart>(key)
        ?.items.find((i) => isSame(i, input))?.quantity
      queryClient.setQueryData<Cart>(key, (cart) => cart && withQuantity(cart, input))
      return { previous }
    },
    onError: (error, input, context) => {
      if (owner && context?.previous !== undefined) {
        const rollback = { ...input, quantity: context.previous }
        queryClient.setQueryData<Cart>(
          queryKeys.cart(owner),
          (cart) => cart && withQuantity(cart, rollback),
        )
      }
      refreshStockOnConflict(queryClient, error, input.nftId)
    },
    onSettled: () => {
      if (owner) settle(queryClient, owner)
    },
  })
}

/** Remove um item. Sem otimismo: a linha some quando a API confirma. */
export function useRemoveItem() {
  const owner = useCartOwner()
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: MUTATION_KEY,
    mutationFn: (input: ItemRef) => {
      if (!owner) throw new Error('Sessão em recuperação. Tente de novo em instantes.')
      return cartApi.removeItem(guestIdOf(owner), input.nftId, input.editionId)
    },
    onSuccess: (_cart, input) => {
      if (!owner) return
      queryClient.setQueryData<Cart>(
        queryKeys.cart(owner),
        (cart) => cart && { ...cart, items: cart.items.filter((i) => !isSame(i, input)) },
      )
    },
    onSettled: () => {
      if (owner) settle(queryClient, owner)
    },
  })
}
