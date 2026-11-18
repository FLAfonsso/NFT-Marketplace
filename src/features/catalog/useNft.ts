import { useQuery } from '@tanstack/react-query'
import type { NftListQuery } from '@/contracts'
import { queryKeys } from '@/lib/queryKeys'
import { nftApi } from './nftApi'

/** Detalhe do NFT. A chave inclui o id; refetch em segundo plano mantém os dados na tela. */
export function useNft(id: string) {
  return useQuery({
    queryKey: queryKeys.nfts.detail(id),
    queryFn: ({ signal }) => nftApi.get(id, signal),
  })
}

const RELATED_FETCH_SIZE = 20

/** Outros NFTs da mesma coleção (sem o atual). */
export function useCollectionNfts(collection: string, excludeId: string) {
  const query: NftListQuery = {
    view: 'all',
    collections: [collection],
    networks: [],
    sort: 'recent',
    page: 1,
    pageSize: RELATED_FETCH_SIZE,
  }
  return useQuery({
    queryKey: queryKeys.nfts.list(query),
    queryFn: ({ signal }) => nftApi.list(query, signal),
    select: (data) => data.items.filter((nft) => nft.id !== excludeId),
  })
}

