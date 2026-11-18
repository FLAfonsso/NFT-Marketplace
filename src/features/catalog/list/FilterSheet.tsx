import { SlidersHorizontalIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import type { NftFacets } from '@/contracts'
import { FilterPanel, type FilterDraft } from './FilterPanel'
import type { useCatalogSearch } from './useCatalogSearch'

type Api = ReturnType<typeof useCatalogSearch>

/** Filtros em Sheet (mobile e tablet): edita um rascunho e só "Aplicar" grava na URL. */
export function FilterSheet({
  facets,
  search,
  update,
  activeCount,
}: {
  facets: NftFacets | undefined
  search: Api['search']
  update: Api['update']
  /** Quantos grupos de filtro estão ativos, só para o rótulo do botão. */
  activeCount: number
}) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            size="icon-lg"
            className="relative size-11 shrink-0 rounded-full md:size-auto md:h-9 md:gap-2 md:rounded-lg md:px-3"
          />
        }
      >
        <SlidersHorizontalIcon aria-hidden="true" />
        <span className="sr-only md:not-sr-only md:uppercase">Filtros</span>
        {activeCount > 0 && (
          <span className="sr-only">{`, ${activeCount} ${activeCount === 1 ? 'ativo' : 'ativos'}`}</span>
        )}
      </SheetTrigger>
      <SheetContent side="left" className="overflow-y-auto">
        <FilterSheetBody facets={facets} search={search} update={update} onDone={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}

/** Montado só com o Sheet aberto: o rascunho nasce sempre da URL atual. */
function FilterSheetBody({
  facets,
  search,
  update,
  onDone,
}: {
  facets: NftFacets | undefined
  search: Api['search']
  update: Api['update']
  onDone: () => void
}) {
  const [draft, setDraft] = useState<FilterDraft>({
    collections: search.collections,
    networks: search.networks,
    priceMin: search.priceMin,
    priceMax: search.priceMax,
  })
  return (
    <>
      <SheetHeader>
        <SheetTitle>Filtros</SheetTitle>
        <SheetDescription>Escolha coleções, preço e rede e toque em Aplicar.</SheetDescription>
      </SheetHeader>
      <div className="px-4">
        <FilterPanel
          facets={facets}
          draft={draft}
          onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        />
      </div>
      <SheetFooter className="sticky bottom-0 flex-row gap-2 border-t border-border bg-popover">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => setDraft({ collections: [], networks: [] })}
        >
          Limpar
        </Button>
        <Button
          type="button"
          className="flex-1 uppercase"
          onClick={() => {
            update(draft)
            onDone()
          }}
        >
          Aplicar
        </Button>
      </SheetFooter>
    </>
  )
}
