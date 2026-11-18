import { FavoriteList } from '@/contracts'
import { api } from '@/lib/api'

export const favoritesApi = {
  list: (signal?: AbortSignal) => api.get(FavoriteList, '/favorites', { signal }),
  add: (nftId: string) => api.put(FavoriteList, `/favorites/${encodeURIComponent(nftId)}`),
  remove: (nftId: string) => api.delete(FavoriteList, `/favorites/${encodeURIComponent(nftId)}`),
}
