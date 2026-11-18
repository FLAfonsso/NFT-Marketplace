import { useId } from 'react'
import type { NftEdition } from '@/contracts'
import { cn } from '@/lib/utils'

/** Grupo de chips (radiogroup nativo: setas navegam, desabilitado é pulado). Esgotada: texto. */
export function EditionPicker({
  editions,
  value,
  onChange,
  className,
}: {
  editions: readonly NftEdition[]
  value: string | null
  onChange: (editionId: string) => void
  className?: string
}) {
  const name = useId()
  const labelId = `${name}-label`
  return (
    <div className={className}>
      <p id={labelId} className="mb-2 text-sm font-bold">
        Edição:
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {editions.map((edition) => {
          const soldOut = edition.available === 0
          return (
            <label
              key={edition.id}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-full border border-border px-3 text-xs transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring',
                soldOut
                  ? 'cursor-not-allowed text-placeholder'
                  : 'cursor-pointer hover:border-primary/60',
                value === edition.id && 'border-primary text-primary',
              )}
            >
              <input
                type="radio"
                name={name}
                value={edition.id}
                checked={value === edition.id}
                disabled={soldOut}
                onChange={() => onChange(edition.id)}
                className="sr-only"
              />
              <span className={cn(soldOut && 'line-through')}>{edition.name}</span>
              {soldOut && <span className="text-[10px]">Esgotada</span>}
            </label>
          )
        })}
      </div>
    </div>
  )
}
