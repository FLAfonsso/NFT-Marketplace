import { http, HttpResponse } from 'msw'
import { NftListQuery, type Nft, type NftFacet, type NftListResponse } from '@/contracts'
import { NFT_COLLECTIONS, NFT_NETWORKS } from '../db/seed'
import { read } from '../db/store'
import { Eth, normalizeText } from '../db/util'
import { API, fail, param, parseWith, route } from './utils'

/** "Novos lançamentos": NFTs criados até 7 dias antes do mais recente do catálogo. */
const NEW_WINDOW_MS = 7 * 24 * 3_600_000
/** "Em alta": os N NFTs com mais avaliações. */
const TRENDING_COUNT = 12

const compareBy: Record<NftListQuery['sort'], (a: Nft, b: Nft) => number> = {
  recent: (a, b) => b.createdAt.localeCompare(a.createdAt),
  price_asc: (a, b) => new Eth(a.price).comparedTo(b.price),
  price_desc: (a, b) => new Eth(b.price).comparedTo(a.price),
  name_asc: (a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }),
}

/** Lista na query string: chave repetida, `chave[]` e `a,b` valem. */
const listFrom = (search: URLSearchParams, key: string) => [
  ...search.getAll(key),
  ...search.getAll(`${key}[]`),
]

/** Parâmetros em objeto simples; as chaves de lista viram arrays. */
const paramsFrom = (url: URL) => {
  const { searchParams } = url
  const params: Record<string, unknown> = {}
  for (const key of new Set(searchParams.keys())) {
    if (key.endsWith('[]')) continue
    params[key] = searchParams.get(key)
  }
  for (const key of ['collections', 'networks']) {
    const values = listFrom(searchParams, key).flatMap((v) => v.split(','))
    if (values.length > 0) params[key] = values
  }
  return params
}

/** Recorte do catálogo escolhido pela aba (view). */
const inView = (nfts: readonly Nft[], view: NftListQuery['view']): readonly Nft[] => {
  if (view === 'new') {
    const newest = nfts.reduce((max, n) => Math.max(max, Date.parse(n.createdAt)), 0)
    return nfts.filter((n) => Date.parse(n.createdAt) >= newest - NEW_WINDOW_MS)
  }
  if (view === 'trending') {
    return [...nfts]
      .sort((a, b) => b.rating.count - a.rating.count || a.id.localeCompare(b.id))
      .slice(0, TRENDING_COUNT)
  }
  return nfts
}

export const nftHandlers = [
  http.get(
    `${API}/nfts`,
    route(({ request }) => {
      const query = parseWith(NftListQuery, paramsFrom(new URL(request.url)))

      if (query.priceMin && query.priceMax && new Eth(query.priceMin).gt(query.priceMax)) {
        fail('validation', 'Preço mínimo maior que o máximo.', {
          priceMin: ['Deve ser menor ou igual ao preço máximo'],
        })
      }

      const term = query.q ? normalizeText(query.q) : ''
      const collections = new Set(query.collections)
      const networks = new Set(query.networks)

      /** Filtros ativos. `skip` ignora o filtro do próprio grupo ao contar as facets. */
      const matches = (nft: Nft, skip?: 'collections' | 'networks') => {
        if (term) {
          const haystack = normalizeText(
            `${nft.name} ${nft.creator} ${nft.collectionName} ${nft.description}`,
          )
          if (!haystack.includes(term)) return false
        }
        if (skip !== 'collections' && collections.size > 0 && !collections.has(nft.collection)) {
          return false
        }
        if (skip !== 'networks' && networks.size > 0 && !networks.has(nft.network)) return false
        if (query.priceMin && new Eth(nft.price).lt(query.priceMin)) return false
        if (query.priceMax && new Eth(nft.price).gt(query.priceMax)) return false
        return true
      }

      const scope = inView(read().nfts, query.view)
      const filtered = scope.filter((nft) => matches(nft))

      const countBy = (
        skip: 'collections' | 'networks',
        options: readonly { id: string; name: string }[],
        keyOf: (nft: Nft) => string,
      ): NftFacet[] => {
        const counts = new Map<string, number>()
        for (const nft of scope) {
          if (matches(nft, skip)) counts.set(keyOf(nft), (counts.get(keyOf(nft)) ?? 0) + 1)
        }
        return options.map(({ id, name }) => ({ id, name, count: counts.get(id) ?? 0 }))
      }

      // Desempate por id para a ordem ser estável entre páginas.
      const sorted = [...filtered].sort(
        (a, b) => compareBy[query.sort](a, b) || a.id.localeCompare(b.id),
      )
      const total = sorted.length
      const start = (query.page - 1) * query.pageSize
      return HttpResponse.json<NftListResponse>({
        items: sorted.slice(start, start + query.pageSize),
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
        facets: {
          collections: countBy('collections', NFT_COLLECTIONS, (n) => n.collection),
          networks: countBy('networks', NFT_NETWORKS, (n) => n.network),
        },
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
