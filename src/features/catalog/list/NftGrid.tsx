import { toast } from 'sonner'
import type { Nft } from '@/contracts'
import { useAddToCart } from '@/features/cart'
import { useFavorites } from '@/features/favorites'
import { isApiRequestError } from '@/lib/api'
import { NftCard, NftCardSkeleton } from './NftCard'

export const gridClass = 'grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 md:gap-x-6 md:gap-y-8'

export const PAGE_SKELETON_COUNT = 9

export function NftGridSkeleton() {
  return (
    <ul className={gridClass} aria-hidden="true">
      {Array.from({ length: PAGE_SKELETON_COUNT }, (_, i) => (
        <NftCardSkeleton key={i} />
      ))}
    </ul>
  )
}

/** Grid de cards. Favoritos e carrinho têm uma única mutation para a página toda. */
export function NftGrid({ items }: { items: readonly Nft[] }) {
  const favorites = useFavorites()
  const addToCart = useAddToCart()

  const add = (nft: Nft) => {
    const edition = nft.editions.find((e) => e.available > 0)
    if (!edition) return
    addToCart.mutate(
      { nftId: nft.id, editionId: edition.id, quantity: 1 },
      {
        onSuccess: () => toast.success(`${nft.name} (edição ${edition.name}) adicionado ao carrinho.`),
        onError: (error) =>
          toast.error(
            isApiRequestError(error) ? error.message : 'Não foi possível adicionar ao carrinho. Tente de novo.',
          ),
      },
    )
  }

  const pendingNftId = addToCart.isPending ? addToCart.variables?.nftId : undefined

  return (
    <ul className={gridClass}>
      {items.map((nft) => (
        <NftCard
          key={nft.id}
          nft={nft}
          isFavorite={favorites.isFavorite(nft.id)}
          favoriteBusy={favorites.busy}
          onToggleFavorite={favorites.toggle}
          onAddToCart={add}
          adding={pendingNftId === nft.id}
        />
      ))}
    </ul>
  )
}
