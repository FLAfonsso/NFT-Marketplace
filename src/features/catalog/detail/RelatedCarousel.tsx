import { NftCarousel } from '@/components/NftCarousel'
import type { Nft } from '@/contracts'
import { useCollectionNfts } from '../useNft'

/** "Mais desta coleção": outros NFTs da mesma coleção do detalhe. */
export function RelatedCarousel({ nft }: { nft: Nft }) {
  const { data, isPending, isError, refetch } = useCollectionNfts(nft.collection, nft.id)
  return (
    <NftCarousel
      title="Mais desta coleção"
      listLabel="Mais NFTs desta coleção"
      items={data}
      isPending={isPending}
      isError={isError}
      onRetry={() => void refetch()}
    />
  )
}
