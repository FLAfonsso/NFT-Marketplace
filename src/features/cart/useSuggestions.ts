import { useQuery } from '@tanstack/react-query'
import type { NftListQuery } from '@/contracts'
import { nftApi } from '@/features/catalog/nftApi'
import { queryKeys } from '@/lib/queryKeys'

const SUGGESTIONS_FETCH_SIZE = 20
const SUGGESTIONS_MAX = 15

const query: NftListQuery = {
  view: 'trending',
  collections: [],
  networks: [],
  sort: 'recent',
  page: 1,
  pageSize: SUGGESTIONS_FETCH_SIZE,
}

/** "Colecionadores também viram": NFTs em alta da API, sem os que já estão no carrinho. */
export function useSuggestions(inCartIds: readonly string[]) {
  return useQuery({
    queryKey: queryKeys.nfts.list(query),
    queryFn: ({ signal }) => nftApi.list(query, signal),
    select: (data) =>
      data.items.filter((nft) => !inCartIds.includes(nft.id)).slice(0, SUGGESTIONS_MAX),
  })
}
