import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth'
import { queryKeys, type CartOwner } from '@/lib/queryKeys'
import { cartApi } from './cartApi'
import { getGuestId } from './guestId'

/** Carrinho do usuário logado ou do visitante. A chave inclui o dono (cache isolado). */
export function useCart() {
  const auth = useAuth()
  const ready = auth.status !== 'loading'
  const owner: CartOwner | null =
    auth.status === 'authenticated' ? { userId: auth.user.id } : ready ? { guestId: getGuestId() } : null

  const query = useQuery({
    queryKey: queryKeys.cart(owner ?? { guestId: '' }),
    queryFn: ({ signal }) =>
      cartApi.get(owner && 'guestId' in owner ? owner.guestId : null, signal),
    enabled: owner !== null,
  })

  /** Quantidade total de itens (soma das quantidades, não de linhas). */
  const itemCount = query.data?.items.reduce((sum, item) => sum + item.quantity, 0)
  return { ...query, itemCount }
}
