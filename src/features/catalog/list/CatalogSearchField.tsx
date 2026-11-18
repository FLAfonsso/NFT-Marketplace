import { SearchIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'

const DEBOUNCE_MS = 300

/**
 * Campo "Explorar coleções" (mobile), ligado ao param `q`. Debounce de 300 ms; Enter aplica
 * na hora. Mudança de `q` vinda de fora (voltar, limpar filtros) atualiza o campo.
 */
export function CatalogSearchField({
  q,
  onSearch,
}: {
  q: string
  onSearch: (q: string | undefined) => void
}) {
  const [value, setValue] = useState(q)
  const timer = useRef<number | undefined>(undefined)

  const apply = (next: string) => {
    window.clearTimeout(timer.current)
    const trimmed = next.trim()
    if (trimmed !== q) onSearch(trimmed || undefined)
  }

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const [seen, setSeen] = useState(q)
  if (seen !== q) {
    setSeen(q)
    setValue(q)
  }

  return (
    <form
      role="search"
      className="relative flex-1"
      onSubmit={(event) => {
        event.preventDefault()
        apply(value)
      }}
    >
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-primary"
        aria-hidden="true"
      />
      <Input
        type="search"
        aria-label="Explorar coleções"
        placeholder="Explorar coleções"
        value={value}
        maxLength={100}
        onChange={(event) => {
          setValue(event.target.value)
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => apply(event.target.value), DEBOUNCE_MS)
        }}
        className="h-11 rounded-full border-border bg-surface pl-12 text-base placeholder:text-placeholder"
      />
    </form>
  )
}
