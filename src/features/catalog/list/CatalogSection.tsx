import { Loader2Icon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { CATALOG_ANCHOR } from '@/components/layout/content'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NFT_VIEWS, type NftFacets, type NftView } from '@/contracts'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import { CatalogSearchField } from './CatalogSearchField'
import { FilterSheet } from './FilterSheet'
import { FilterSidebar } from './FilterSidebar'
import { NftGrid, NftGridSkeleton } from './NftGrid'
import { Pagination } from './Pagination'
import { SortSelect } from './SortSelect'
import { useCatalogQuery } from './useCatalogQuery'
import { useCatalogSearch } from './useCatalogSearch'

const VIEW_LABELS: Record<NftView, string> = {
  all: 'Todos os NFTs',
  new: 'Novos lançamentos',
  trending: 'Em alta',
}

const isView = (value: unknown): value is NftView => NFT_VIEWS.some((view) => view === value)

/** Seção do catálogo da Início (âncora #catalogo). Todo o estado de consulta mora na URL. */
export function CatalogSection({ sidebarExtra }: { sidebarExtra?: ReactNode }) {
  const { search, update, clear, hasFilters } = useCatalogSearch()
  const query = useCatalogQuery(search)
  const isSidebar = useMediaQuery('(min-width: 1024px)')

  // Últimas contagens conhecidas: a sidebar não esvazia durante um erro ou recarga.
  const [facets, setFacets] = useState<NftFacets | undefined>(undefined)
  if (query.data && query.data.facets !== facets) setFacets(query.data.facets)

  const data = query.data
  const refreshing = query.isFetching && !query.isPending

  // Página além do fim (URL editada, ou filtro que encolheu o resultado): vai para a última.
  const lastPage = data && !query.isPlaceholderData && data.items.length === 0 ? data.totalPages : 0
  useEffect(() => {
    if (lastPage > 0 && search.page > lastPage) void update({ page: lastPage }, { replace: true })
  }, [lastPage, search.page, update])

  const activeFilters =
    (search.q ? 1 : 0) +
    (search.collections.length > 0 ? 1 : 0) +
    (search.networks.length > 0 ? 1 : 0) +
    (search.priceMin || search.priceMax ? 1 : 0)

  const priceKey = `${search.priceMin ?? ''}|${search.priceMax ?? ''}|${search.collections.join()}|${search.networks.join()}`

  let body
  if (query.isError) {
    body = (
      <div
        role="alert"
        className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-lg border border-border bg-surface p-6 text-center"
      >
        <p className="font-bold">Não foi possível carregar os NFTs.</p>
        <p className="text-sm text-muted-foreground">Verifique a conexão e tente novamente.</p>
        <Button type="button" onClick={() => void query.refetch()} className="uppercase">
          Tentar de novo
        </Button>
      </div>
    )
  } else if (!data) {
    body = <NftGridSkeleton />
  } else if (data.items.length === 0) {
    body = (
      <div className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-lg border border-border bg-surface p-6 text-center">
        <p className="font-bold">
          {hasFilters ? 'Nenhum NFT encontrado.' : 'Nenhum NFT disponível no momento.'}
        </p>
        {hasFilters && (
          <>
            <p className="text-sm text-muted-foreground">
              {search.q ? `Nada para "${search.q}" com estes filtros. ` : ''}Tente outra busca ou ajuste os filtros.
            </p>
            <Button type="button" variant="outline" onClick={() => void clear()} className="uppercase">
              Limpar filtros
            </Button>
          </>
        )}
      </div>
    )
  } else {
    body = (
      <>
        <div className={cn('transition-opacity', query.isPlaceholderData && 'opacity-60')}>
          <NftGrid items={data.items} />
        </div>
        <div className="mt-8">
          <Pagination page={data.page} totalPages={data.totalPages} />
        </div>
      </>
    )
  }

  return (
    <section
      id={CATALOG_ANCHOR}
      aria-labelledby="catalogo-titulo"
      className="mx-auto w-full max-w-304 scroll-mt-16 px-4 py-6 md:px-6 md:py-10"
    >
      <h2 id="catalogo-titulo" className="sr-only">
        Catálogo de NFTs
      </h2>

      <div className="grid gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
        {isSidebar && (
          <div className="self-start">
            <aside aria-label="Filtros" className="rounded-lg bg-surface p-5">
              <FilterSidebar key={priceKey} facets={facets} search={search} update={update} />
            </aside>
            {sidebarExtra}
          </div>
        )}

        <div className="min-w-0">
          {!isSidebar && (
            <div className="mb-4 flex items-center gap-3 md:justify-end">
              <div className="flex-1 md:hidden">
                <CatalogSearchField
                  q={search.q ?? ''}
                  onSearch={(q) => void update({ q }, { replace: true })}
                />
              </div>
              <FilterSheet facets={facets} search={search} update={update} activeCount={activeFilters} />
            </div>
          )}

          <Tabs
            value={search.view}
            onValueChange={(next) => {
              if (isView(next)) void update({ view: next })
            }}
          >
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-border">
              <div className="-mb-px max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <TabsList
                  variant="line"
                  aria-label="Tipo de listagem"
                  className="h-auto! w-max gap-5 p-0 md:gap-8"
                >
                  {NFT_VIEWS.map((view) => (
                    <TabsTrigger
                      key={view}
                      value={view}
                      className="h-11! flex-none px-0 text-sm text-foreground/80! after:bottom-0! after:bg-primary! data-active:text-primary!"
                    >
                      {VIEW_LABELS[view]}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              <div className="pb-1.5">
                <SortSelect value={search.sort} onChange={(sort) => void update({ sort })} />
              </div>
            </div>

            <div className="flex h-9 items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
              {refreshing ? (
                <>
                  <Loader2Icon className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  Atualizando resultados…
                </>
              ) : data ? (
                `${data.total} ${data.total === 1 ? 'NFT' : 'NFTs'}`
              ) : null}
            </div>

            {NFT_VIEWS.map((view) => (
              <TabsContent key={view} value={view} className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-busy={query.isFetching}>
                {view === search.view && body}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </section>
  )
}
