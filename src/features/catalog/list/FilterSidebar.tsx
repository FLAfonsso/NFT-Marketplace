import { useState } from 'react'
import type { NftFacets } from '@/contracts'
import { FilterPanel, type FilterDraft } from './FilterPanel'
import type { useCatalogSearch } from './useCatalogSearch'

type Api = ReturnType<typeof useCatalogSearch>

/**
 * Sidebar (desktop). Coleções e Rede aplicam ao marcar; a faixa de preço só em "Aplicar".
 * O rascunho do preço é descartado quando a URL muda (o pai troca a `key`).
 */
export function FilterSidebar({
  facets,
  search,
  update,
}: {
  facets: NftFacets | undefined
  search: Api['search']
  update: Api['update']
}) {
  const [price, setPrice] = useState({ priceMin: search.priceMin, priceMax: search.priceMax })
  const draft: FilterDraft = {
    collections: search.collections,
    networks: search.networks,
    ...price,
  }
  return (
    <FilterPanel
      facets={facets}
      draft={draft}
      onChange={(patch) => {
        if (patch.collections) update({ collections: patch.collections })
        if (patch.networks) update({ networks: patch.networks })
        if ('priceMin' in patch || 'priceMax' in patch) {
          setPrice({ priceMin: patch.priceMin, priceMax: patch.priceMax })
        }
      }}
      onApplyPrice={() => update(price)}
    />
  )
}
