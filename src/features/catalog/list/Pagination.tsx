import { Link } from '@tanstack/react-router'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { scrollToCatalog } from './scrollToCatalog'

const box =
  'grid size-9 place-items-center rounded-sm border border-border text-sm outline-none hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-ring'

/** Páginas visíveis: sempre a primeira, a última e a vizinhança da atual; o resto vira "…". */
function pageItems(current: number, total: number): (number | 'gap-start' | 'gap-end')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const wanted = new Set([1, total, current - 1, current, current + 1])
  const pages = [...wanted].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const items: (number | 'gap-start' | 'gap-end')[] = []
  pages.forEach((page, index) => {
    const previous = pages[index - 1]
    if (previous !== undefined && page - previous > 1) items.push(index <= 1 ? 'gap-start' : 'gap-end')
    items.push(page)
  })
  return items
}

/** Paginação 1..N com anterior e próxima. A página mora na URL; cada item é um link. */
export function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null
  const link = (target: number) => ({
    to: '/' as const,
    search: (prev: Record<string, unknown>) => ({ ...prev, page: target }),
    resetScroll: false,
    onClick: scrollToCatalog,
    // Sem isso o Link marca aria-current em toda página cujos params são um subconjunto da URL.
    activeOptions: { includeSearch: true, exact: true },
  })
  return (
    <nav aria-label="Paginação" className="flex justify-end">
      <ul className="flex flex-wrap items-center gap-2">
        {page > 1 && (
          <li>
            <Link {...link(page - 1)} aria-label="Página anterior" className={box}>
              <ChevronLeftIcon className="size-4" aria-hidden="true" />
            </Link>
          </li>
        )}
        {pageItems(page, totalPages).map((item) =>
          typeof item === 'string' ? (
            <li key={item} aria-hidden="true" className="px-1 text-muted-foreground">
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                {...link(item)}
                aria-label={`Página ${item}`}
                aria-current={item === page ? 'page' : undefined}
                className={cn(box, item === page && 'border-primary bg-primary font-bold text-primary-foreground hover:text-primary-foreground')}
              >
                {item}
              </Link>
            </li>
          ),
        )}
        {page < totalPages && (
          <li>
            <Link {...link(page + 1)} aria-label="Próxima página" className={box}>
              <ChevronRightIcon className="size-4" aria-hidden="true" />
            </Link>
          </li>
        )}
      </ul>
    </nav>
  )
}
