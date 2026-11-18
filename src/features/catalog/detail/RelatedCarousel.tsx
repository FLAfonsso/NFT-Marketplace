import { Link } from '@tanstack/react-router'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { Nft } from '@/contracts'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { useCollectionNfts } from '../useNft'

const arrow =
  'grid size-8 place-items-center rounded-full border border-border outline-none hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40'

/** "Mais desta coleção": 5 cards por página no desktop, rolagem por teclado e botões, pontos de página. */
export function RelatedCarousel({ nft }: { nft: Nft }) {
  const { data: items, isPending, isError, refetch } = useCollectionNfts(nft.collection, nft.id)
  const scroller = useRef<HTMLUListElement>(null)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(0)

  const measure = useCallback(() => {
    const el = scroller.current
    if (!el) return
    const width = el.clientWidth
    setPages(Math.max(1, Math.round(el.scrollWidth / width)))
    setPage(Math.min(Math.round(el.scrollLeft / width), Math.round(el.scrollWidth / width) - 1))
  }, [])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [measure, items])

  const goTo = (target: number) => {
    const el = scroller.current
    if (!el) return
    const clamped = Math.max(0, Math.min(target, pages - 1))
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: clamped * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' })
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      goTo(page + 1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      goTo(page - 1)
    }
  }

  if (isPending || (items && items.length === 0)) return null

  return (
    <section aria-labelledby="related-title" className="flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h2 id="related-title" className="text-sm font-bold text-primary">
          Mais desta coleção
        </h2>
        {items && (
          <div className="flex gap-2">
            <button type="button" aria-label="Página anterior" disabled={page === 0} onClick={() => goTo(page - 1)} className={arrow}>
              <ChevronLeftIcon className="size-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label="Próxima página" disabled={page >= pages - 1} onClick={() => goTo(page + 1)} className={arrow}>
              <ChevronRightIcon className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {isError || !items ? (
        <div role="alert" className="flex items-center gap-3 text-sm text-muted-foreground">
          Não foi possível carregar a coleção.
          <button type="button" onClick={() => void refetch()} className="text-primary underline underline-offset-4">
            Tentar de novo
          </button>
        </div>
      ) : (
        <>
          <ul
            ref={scroller}
            tabIndex={0}
            aria-label="Mais NFTs desta coleção. Use as setas para rolar."
            onKeyDown={onKeyDown}
            onScroll={measure}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth rounded-sm outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-ring motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden"
          >
            {items.map((item) => (
              <li
                key={item.id}
                className="w-[calc((100%-1rem)/2)] shrink-0 snap-start md:w-[calc((100%-4rem)/5)]"
              >
                <Link
                  to="/nft/$id"
                  params={{ id: item.id }}
                  className="flex flex-col gap-1.5 rounded-sm text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="block aspect-square overflow-hidden rounded-sm bg-surface p-2">
                    <img
                      src={item.gallery[0]?.url}
                      alt={item.gallery[0]?.alt ?? item.name}
                      loading="lazy"
                      className="size-full rounded-lg object-cover"
                    />
                  </span>
                  <span className="truncate">{item.name}</span>
                  <span className="font-bold text-primary">{formatEth(item.price)} ETH</span>
                </Link>
              </li>
            ))}
          </ul>

          {pages > 1 && (
            <div className="flex justify-center gap-2" role="group" aria-label="Páginas do carrossel">
              {Array.from({ length: pages }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Página ${i + 1} de ${pages}`}
                  aria-current={i === page ? 'true' : undefined}
                  onClick={() => goTo(i)}
                  className="grid size-6 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={cn(
                      'size-2.5 rounded-full border border-primary',
                      i === page && 'bg-primary',
                    )}
                  />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
