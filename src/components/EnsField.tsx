import { ChevronDownIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { TextField } from '@/components/FormField'

/**
 * Nome ENS: seletor ".eth" (única opção, como no layout) e o nome digitado. O campo guarda só o
 * nome; o ".eth" é acrescentado pelo schema (src/lib/formSchemas.ts).
 */
export function EnsField(props: Omit<ComponentProps<typeof TextField>, 'label' | 'leading' | 'required'>) {
  return (
    <TextField
      placeholder="seu-nome"
      autoComplete="off"
      spellCheck={false}
      {...props}
      label="Nome ENS"
      required
      leading={
        <span className="relative shrink-0">
          <select
            aria-label="Domínio do nome ENS"
            defaultValue=".eth"
            className="h-10 w-20 appearance-none rounded-sm border border-border bg-background pr-7 pl-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <option value=".eth">.eth</option>
          </select>
          <ChevronDownIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground"
          />
        </span>
      }
    />
  )
}
