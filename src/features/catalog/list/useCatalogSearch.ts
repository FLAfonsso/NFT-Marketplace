import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback } from 'react'
import type { CatalogSearch } from '../searchParams'

type Patch = Partial<Omit<CatalogSearch, 'page'>> & { page?: number }

/**
 * Estado do catálogo na URL. Toda mudança de filtro, busca, aba ou ordenação volta para a
 * página 1; só quem passa `page` explicitamente a mantém. Não rola a tela (resetScroll: false).
 */
export function useCatalogSearch() {
  const search = useSearch({ from: '/' })
  const navigate = useNavigate({ from: '/' })

  const update = useCallback(
    (patch: Patch, options?: { replace?: boolean }) =>
      navigate({
        search: (prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }),
        replace: options?.replace,
        resetScroll: false,
      }),
    [navigate],
  )

  /** Remove busca e filtros; mantém aba e ordenação. */
  const clear = useCallback(
    () =>
      navigate({
        search: (prev) => ({ view: prev.view, sort: prev.sort }),
        resetScroll: false,
      }),
    [navigate],
  )

  const hasFilters =
    !!search.q ||
    search.collections.length > 0 ||
    search.networks.length > 0 ||
    !!search.priceMin ||
    !!search.priceMax

  return { search, update, clear, hasFilters }
}
