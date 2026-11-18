import { useNavigate, useRouterState } from '@tanstack/react-router'
import { SearchIcon, XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const DEBOUNCE_MS = 300

/**
 * Lupa que abre um campo de busca. Atualiza o search param `q` de "/" com debounce de 300 ms.
 * Teclado: Enter aplica na hora, Esc fecha e devolve o foco à lupa.
 */
export function HeaderSearch() {
  const navigate = useNavigate()
  const { pathname, search } = useRouterState({ select: (s) => s.location })
  const urlQuery = pathname === '/' && typeof search.q === 'string' ? search.q : ''
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(urlQuery)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const lastApplied = useRef(urlQuery)

  const apply = (next: string) => {
    window.clearTimeout(timer.current)
    const q = next.trim() || undefined
    if ((q ?? '') === lastApplied.current) return
    lastApplied.current = q ?? ''
    // Em "/" mantém os filtros e volta à página 1; fora de "/" abre a Início só com a busca.
    void navigate({
      to: '/',
      search: (prev) => ({
        ...(pathname === '/' ? prev : {}),
        q,
        page: 1,
      }),
    })
  }

  const onChange = (next: string) => {
    setValue(next)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => apply(next), DEBOUNCE_MS)
  }

  useEffect(() => () => window.clearTimeout(timer.current), [])

  // URL mudou por fora (limpar filtros, voltar no histórico): o campo acompanha.
  const [seenUrlQuery, setSeenUrlQuery] = useState(urlQuery)
  if (seenUrlQuery !== urlQuery) {
    setSeenUrlQuery(urlQuery)
    setValue(urlQuery)
  }
  useEffect(() => {
    lastApplied.current = urlQuery
  }, [urlQuery])

  const close = () => {
    setOpen(false)
    // A lupa só volta ao DOM depois da renderização.
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  if (!open) {
    return (
      <button
        ref={triggerRef}
        type="button"
        aria-label="Buscar"
        aria-expanded="false"
        onClick={() => {
          setOpen(true)
          requestAnimationFrame(() => inputRef.current?.focus())
        }}
        className="grid size-8 place-items-center rounded-sm text-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
      >
        <SearchIcon className="size-4" aria-hidden="true" />
      </button>
    )
  }

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        apply(value)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') close()
      }}
      className="flex h-8 items-center gap-1 rounded-sm border border-border bg-surface pl-2"
    >
      <SearchIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={100}
        aria-label="Buscar NFTs"
        placeholder="Buscar NFTs..."
        className="h-full w-44 bg-transparent text-xs text-foreground outline-none placeholder:text-placeholder [&::-webkit-search-cancel-button]:hidden"
      />
      <button
        type="button"
        aria-label="Fechar busca"
        onClick={close}
        className="grid size-8 place-items-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <XIcon className="size-3.5" aria-hidden="true" />
      </button>
    </form>
  )
}
