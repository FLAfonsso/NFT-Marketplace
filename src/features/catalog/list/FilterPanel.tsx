import { useId } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { Network, type NftFacet, type NftFacets } from '@/contracts'
import { cn } from '@/lib/utils'
import {
  PRICE_MAX,
  PRICE_MIN,
  SLIDER_MAX,
  SLIDER_MIN,
  ethFromStep,
  paramFromStep,
  stepsFrom,
} from './price'

export type FilterDraft = {
  collections: string[]
  networks: Network[]
  priceMin?: string
  priceMax?: string
}

const isNetwork = (id: string): id is Network => Network.options.some((n) => n === id)

const toggled = (list: readonly string[], id: string) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id]

const heading = 'text-base font-bold text-foreground'

function FacetGroup({
  title,
  facets,
  selected,
  onChange,
  skeletonRows,
}: {
  title: string
  facets: readonly NftFacet[] | undefined
  selected: readonly string[]
  onChange: (next: string[]) => void
  skeletonRows: number
}) {
  const prefix = useId()
  const titleId = `${prefix}-title`
  return (
    <div role="group" aria-labelledby={titleId} className="flex flex-col gap-2">
      <h3 id={titleId} className={heading}>
        {title}
      </h3>
      <ul className="flex flex-col gap-1">
        {facets
          ? facets.map((facet) => {
              const id = `${prefix}-${facet.id}`
              return (
                <li key={facet.id}>
                  <label
                    htmlFor={id}
                    className="flex min-h-8 w-full cursor-pointer items-center gap-3 rounded-sm px-1 text-sm text-muted-foreground has-[[data-checked]]:text-primary"
                  >
                    <Checkbox
                      id={id}
                      checked={selected.includes(facet.id)}
                      onCheckedChange={() => onChange(toggled(selected, facet.id))}
                    />
                    <span className="flex-1">{facet.name}</span>
                    <span className="text-foreground tabular-nums">({facet.count})</span>
                  </label>
                </li>
              )
            })
          : Array.from({ length: skeletonRows }, (_, i) => (
              <li key={i} aria-hidden="true" className="flex min-h-8 items-center px-1">
                <div className="skeleton-bone skeleton-bone-strong h-4 w-full rounded-sm" />
              </li>
            ))}
      </ul>
    </div>
  )
}

/**
 * Coleções, faixa de preço e Rede. Controlado: quem usa decide quando aplicar. Com `onApplyPrice`
 * a faixa mostra o botão Aplicar (sidebar); sem ele, só altera o rascunho (Sheet, que tem o seu).
 */
export function FilterPanel({
  facets,
  draft,
  onChange,
  onApplyPrice,
}: {
  facets: NftFacets | undefined
  draft: FilterDraft
  onChange: (patch: Partial<FilterDraft>) => void
  onApplyPrice?: () => void
}) {
  const [min, max] = stepsFrom(draft.priceMin, draft.priceMax)
  const priceId = useId()
  return (
    <div className="flex flex-col gap-6">
      <FacetGroup
        title="Coleções"
        facets={facets?.collections}
        selected={draft.collections}
        onChange={(collections) => onChange({ collections })}
        skeletonRows={9}
      />

      <div role="group" aria-labelledby={`${priceId}-title`} className="flex flex-col gap-2">
        <h3 id={`${priceId}-title`} className={heading}>
          Faixa de preço
        </h3>
        <Slider
          min={SLIDER_MIN}
          max={SLIDER_MAX}
          step={1}
          value={[min, max]}
          thumbLabels={['Preço mínimo', 'Preço máximo']}
          getValueText={(v) => `${ethFromStep(v)} ETH`}
          onValueChange={(next) => {
            const [a = SLIDER_MIN, b = SLIDER_MAX] = next
            onChange({ priceMin: paramFromStep(a, 'min'), priceMax: paramFromStep(b, 'max') })
          }}
        />
        <p className="text-sm text-muted-foreground">
          Preço: {ethFromStep(min)} - {ethFromStep(max)} ETH
        </p>
        <p className="sr-only">
          Faixa possível de {PRICE_MIN} a {PRICE_MAX} ETH
        </p>
        {onApplyPrice && (
          <Button type="button" size="sm" className={cn('w-fit uppercase')} onClick={onApplyPrice}>
            Aplicar
          </Button>
        )}
      </div>

      <FacetGroup
        title="Rede"
        facets={facets?.networks}
        selected={draft.networks}
        onChange={(ids) => onChange({ networks: ids.filter(isNetwork) })}
        skeletonRows={3}
      />
    </div>
  )
}
