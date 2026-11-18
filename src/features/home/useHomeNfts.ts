import { useQuery } from '@tanstack/react-query'
import { PAGE_SIZE_MAX, type NftListQuery } from '@/contracts'
import { nftApi } from '@/features/catalog/nftApi'
import { queryKeys } from '@/lib/queryKeys'

export const HERO_SLIDES = 3

const heroQuery: NftListQuery = {
  view: 'trending',
  collections: [],
  networks: [],
  sort: 'recent',
  page: 1,
  pageSize: HERO_SLIDES,
}

/** Três NFTs em alta da API para o carrossel do hero. */
export function useHeroNfts() {
  return useQuery({
    queryKey: queryKeys.nfts.list(heroQuery),
    queryFn: ({ signal }) => nftApi.list(heroQuery, signal),
    select: (data) => data.items.slice(0, HERO_SLIDES),
  })
}

const featuredQuery: NftListQuery = {
  view: 'all',
  collections: [],
  networks: [],
  sort: 'recent',
  page: 1,
  pageSize: PAGE_SIZE_MAX,
}

/** NFT marcado como destaque (`featured`) pela API. A API não filtra por isso: procura na lista. */
export function useFeaturedNft() {
  return useQuery({
    queryKey: queryKeys.nfts.list(featuredQuery),
    queryFn: ({ signal }) => nftApi.list(featuredQuery, signal),
    select: (data) => data.items.find((nft) => nft.featured),
  })
}
