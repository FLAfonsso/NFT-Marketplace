import { useQuery } from '@tanstack/react-query'
import type { Cart, QuoteRequest } from '@/contracts'
import { queryKeys } from '@/lib/queryKeys'
import { cartApi, guestIdOf } from './cartApi'
import { useCartOwner } from './useCart'

/** Pedido de cotação do carrinho. A API exige ao menos um item, então carrinho vazio dá null. */
export const toQuoteRequest = (
  items: Cart['items'],
  couponCode: string | null,
): QuoteRequest | null =>
  items.length === 0
    ? null
    : {
        items: items.map(({ nftId, editionId, quantity }) => ({ nftId, editionId, quantity })),
        ...(couponCode ? { couponCode } : {}),
      }

/**
 * Cotação do carrinho. A chave tem dono, itens e cupom: mudar a quantidade ou o cupom pede outra
 * cotação, e a anterior fica na tela (placeholder) até a nova chegar, sem pular o layout.
 * O placeholder nunca atravessa donos diferentes.
 */
export function useQuote(cart: Cart | undefined) {
  const owner = useCartOwner()
  const request = cart ? toQuoteRequest(cart.items, cart.couponCode) : null

  return useQuery({
    queryKey: queryKeys.cartQuote(owner ?? { guestId: '' }, request ?? { items: [] }),
    queryFn: ({ signal }) => {
      if (!owner || !request) throw new Error('Cotação sem carrinho.')
      return cartApi.quote(guestIdOf(owner), request, signal)
    },
    enabled: owner !== null && request !== null,
    placeholderData: (previous, previousQuery) =>
      previousQuery && JSON.stringify(previousQuery.queryKey[1]) === JSON.stringify(owner)
        ? previous
        : undefined,
  })
}
