import { Nft, NftListResponse, type NftListQuery } from '@/contracts'
import { api } from '@/lib/api'

export const nftApi = {
  get: (id: string, signal?: AbortSignal) =>
    api.get(Nft, `/nfts/${encodeURIComponent(id)}`, { signal }),
  list: (query: NftListQuery, signal?: AbortSignal) =>
    api.get(NftListResponse, '/nfts', { signal, params: query }),
}
