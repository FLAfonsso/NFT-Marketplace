import { toast } from 'sonner'
import type { Nft } from '@/contracts'
import { useAddToCart } from '@/features/cart'
import { useFavorites } from '@/features/favorites'
import { isApiRequestError } from '@/lib/api'
import { useIsDesktop } from '@/lib/useMediaQuery'
import { NftCard, NftCardSkeleton } from './NftCard'

export const gridClass = 'grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 md:gap-x-6 md:gap-y-8'

export const PAGE_SKELETON_COUNT = 9

export function NftGridSkeleton({ testId = 'catalog-skeleton-grid' }: { testId?: string }) {
  return (
    <ul className={gridClass} aria-hidden="true" data-testid={testId}>
      {Array.from({ length: PAGE_SKELETON_COUNT }, (_, i) => (
        <NftCardSkeleton key={i} />
      ))}
    </ul>
  )
}

/** Grid de cards. Favoritos e carrinho têm uma única mutation para a página toda. */
export function NftGrid({
  items,
  testId = 'catalog-grid',
  eagerFirstRow = false,
}: {
  items: readonly Nft[]
  testId?: string
  /** Carrega a primeira linha (3 colunas no desktop, 2 no mobile) sem lazy; a primeira imagem com prioridade alta. */
  eagerFirstRow?: boolean
}) {
  const isDesktop = useIsDesktop()
  const firstRow = eagerFirstRow ? (isDesktop ? 3 : 2) : 0
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
    <ul className={gridClass} data-testid={testId}>
      {items.map((nft, index) => (
        <NftCard
          key={nft.id}
          nft={nft}
          isFavorite={favorites.isFavorite(nft.id)}
          favoriteBusy={favorites.isBusy(nft.id)}
          onToggleFavorite={favorites.toggle}
          onAddToCart={add}
          adding={pendingNftId === nft.id}
          imageLoading={index < firstRow ? 'eager' : 'lazy'}
          highPriority={index === 0 && firstRow > 0}
        />
      ))}
    </ul>
  )
}
