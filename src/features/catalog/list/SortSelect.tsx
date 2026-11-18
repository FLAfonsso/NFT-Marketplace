import { useId } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NFT_SORTS, type NftSort } from '@/contracts'

const SORT_ITEMS: { value: NftSort; label: string }[] = [
  { value: 'recent', label: 'Listados recentemente' },
  { value: 'price_asc', label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
  { value: 'name_asc', label: 'Nome (A-Z)' },
]

const isSort = (value: unknown): value is NftSort => NFT_SORTS.some((sort) => sort === value)

/** "Ordenar por". O rótulo fica fora do gatilho e do ícone da seta (não se sobrepõem). */
export function SortSelect({ value, onChange }: { value: NftSort; onChange: (sort: NftSort) => void }) {
  const labelId = useId()
  return (
    <div className="flex items-center gap-2 text-sm">
      <span id={labelId} className="max-sm:sr-only">
        Ordenar por:
      </span>
      <Select
        items={SORT_ITEMS}
        value={value}
        onValueChange={(next) => {
          if (isSort(next)) onChange(next)
        }}
      >
        <SelectTrigger
          aria-labelledby={labelId}
          className="h-9 w-52 gap-3 border-border pr-3 text-primary sm:w-64"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} align="end" className="min-w-56">
          {SORT_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
