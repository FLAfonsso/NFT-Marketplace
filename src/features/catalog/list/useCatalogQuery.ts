import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { NFT_PAGE_SIZE_DEFAULT, type NftListQuery } from '@/contracts'
import { isApiRequestError } from '@/lib/api'
import { queryKeys } from '@/lib/queryKeys'
import { nftApi } from '../nftApi'
import type { CatalogSearch } from '../searchParams'

export const toListQuery = (search: CatalogSearch): NftListQuery => ({
  q: search.q || undefined,
  view: search.view,
  collections: search.collections,
  networks: search.networks,
  priceMin: search.priceMin,
  priceMax: search.priceMax,
  sort: search.sort,
  page: search.page,
  pageSize: NFT_PAGE_SIZE_DEFAULT,
})

/**
 * Listagem do catálogo. A chave inclui todos os parâmetros: cada combinação tem a própria
 * entrada de cache, e só a resposta da chave atual chega à tela (uma resposta atrasada de
 * parâmetros antigos cai no cache dela e nunca sobrescreve a atual). O AbortSignal cancela
 * a requisição abandonada. A página anterior fica na tela (placeholderData) enquanto a nova
 * carrega; `isPlaceholderData` indica a atualização em segundo plano.
 * Uma nova tentativa só: a falha transitória aparece com "Tentar de novo" sem esperar o backoff longo.
 */
export function useCatalogQuery(search: CatalogSearch) {
  const query = toListQuery(search)
  return useQuery({
    queryKey: queryKeys.nfts.list(query),
    queryFn: ({ signal }) => nftApi.list(query, signal),
    placeholderData: keepPreviousData,
    retry: (failureCount, error) => failureCount < 1 && isApiRequestError(error) && error.transient,
    retryDelay: 500,
  })
}
