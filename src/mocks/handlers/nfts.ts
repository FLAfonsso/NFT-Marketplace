import { http, HttpResponse } from 'msw'
import {
  NftListQuery,
  type Nft,
  type NftCategoryList,
  type NftListResponse,
} from '@/contracts'
import { NFT_CATEGORIES } from '../db/seed'
import { read } from '../db/store'
import { Eth, normalizeText } from '../db/util'
import { API, fail, param, parseWith, route } from './utils'

const isAvailable = (nft: Nft) => nft.editions.some((e) => e.available > 0)

const compareBy: Record<NftListQuery['sort'], (a: Nft, b: Nft) => number> = {
  recent: (a, b) => b.createdAt.localeCompare(a.createdAt),
  price_asc: (a, b) => new Eth(a.price).comparedTo(b.price),
  price_desc: (a, b) => new Eth(b.price).comparedTo(a.price),
  name_asc: (a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }),
}

export const nftHandlers = [
  // Antes de /nfts/:id para não ser capturada como identificador.
  http.get(
    `${API}/nfts/categories`,
    route(() => HttpResponse.json<NftCategoryList>({ items: [...NFT_CATEGORIES] })),
  ),

  http.get(
    `${API}/nfts`,
    route(({ request }) => {
      const params = Object.fromEntries(new URL(request.url).searchParams)
      const query = parseWith(NftListQuery, params)

      if (query.minPrice && query.maxPrice && new Eth(query.minPrice).gt(query.maxPrice)) {
        fail('validation', 'Preço mínimo maior que o máximo.', {
          minPrice: ['Deve ser menor ou igual ao preço máximo'],
        })
      }

      const term = query.q ? normalizeText(query.q) : ''
      const category = query.category ? normalizeText(query.category) : null

      const filtered = read().nfts.filter((nft) => {
        if (term) {
          const haystack = normalizeText(`${nft.name} ${nft.creator} ${nft.description}`)
          if (!haystack.includes(term)) return false
        }
        if (category && normalizeText(nft.category) !== category) return false
        if (query.minPrice && new Eth(nft.price).lt(query.minPrice)) return false
        if (query.maxPrice && new Eth(nft.price).gt(query.maxPrice)) return false
        if (query.availableOnly && !isAvailable(nft)) return false
        return true
      })

      // Desempate por id para a ordem ser estável entre páginas.
      const sorted = filtered.sort((a, b) => compareBy[query.sort](a, b) || a.id.localeCompare(b.id))
      const total = sorted.length
      const start = (query.page - 1) * query.pageSize
      return HttpResponse.json<NftListResponse>({
        items: sorted.slice(start, start + query.pageSize),
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      })
    }),
  ),

  http.get(
    `${API}/nfts/:id`,
    route(({ params }) => {
      const nft = read().nfts.find((n) => n.id === param(params, 'id'))
      return nft ? HttpResponse.json<Nft>(nft) : fail('not_found', 'NFT não encontrado.')
    }),
  ),
]
