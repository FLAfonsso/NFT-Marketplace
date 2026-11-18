import { ArrowRightIcon } from 'lucide-react'
import { useEffect, useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { scrollToCatalog } from '@/features/catalog/list/scrollToCatalog'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import { hero } from './content'
import { HERO_SLIDES, useHeroNfts } from './useHomeNfts'

const ROTATE_MS = 6000
const IMAGE_SIZE = 500

/** Hero da Início: texto, EXPLORAR e três pontos que trocam o NFT em destaque. */
export function HomeHero() {
  const { data: nfts } = useHeroNfts()
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  const count = nfts?.length ?? 0
  const current = count > 0 ? nfts?.[index % count] : undefined

  useEffect(() => {
    if (reducedMotion || paused || count < 2) return
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS)
    return () => window.clearInterval(timer)
  }, [reducedMotion, paused, count])

  const onDotKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (count < 2) return
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    const next = (index + step + count) % count
    setIndex(next)
    event.currentTarget.querySelectorAll<HTMLButtonElement>('button')[next]?.focus()
  }

  const image = current?.gallery[0]

  return (
    <section
      aria-label="Destaque"
      className="mx-auto w-full max-w-304 px-4 pt-4 md:px-6 md:pt-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-3xl bg-linear-to-br from-surface-strong to-surface p-5',
          'md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:items-center md:gap-8 md:overflow-visible md:rounded-none md:bg-none md:p-0',
        )}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3 md:block md:py-10 md:pl-6">
          <div className="min-w-0">
            <p className="text-xs md:text-sm">{hero.eyebrow}</p>
            <h2 className="mt-2 text-xl leading-tight font-bold md:mt-4 md:text-5xl md:leading-snug">
              <span className="md:hidden">{hero.titleMobile}</span>
              <span className="hidden md:inline">{hero.titleDesktop}</span>
            </h2>
            <p className="mt-3 text-xs text-muted-foreground md:mt-4 md:max-w-md md:text-sm">
              <span className="md:hidden">{hero.textMobile}</span>
              <span className="hidden md:inline">{hero.textDesktop}</span>
            </p>
            <Button
              type="button"
              onClick={scrollToCatalog}
              className="mt-3 hidden uppercase md:mt-6 md:inline-flex"
            >
              {hero.cta}
            </Button>
            <button
              type="button"
              onClick={scrollToCatalog}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
            >
              {hero.cta}
              <ArrowRightIcon className="size-4" aria-hidden="true" />
            </button>
          </div>

          <div className="relative md:hidden">
            {image ? (
              <img
                src={image.url}
                alt=""
                width={IMAGE_SIZE}
                height={IMAGE_SIZE}
                loading="eager"
                fetchPriority="high"
                className="aspect-square w-full rounded-2xl object-cover"
              />
            ) : (
              <div className="shimmer aspect-square w-full rounded-2xl" aria-hidden="true" />
            )}
          </div>

          {count > 1 && (
            <div
              role="group"
              aria-label={hero.dotsLabel}
              onKeyDown={onDotKeyDown}
              className="col-span-2 flex justify-center gap-2 md:col-span-1 md:mt-10 md:justify-start md:pl-[22rem]"
            >
              {Array.from({ length: Math.min(count, HERO_SLIDES) }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`NFT em destaque ${i + 1} de ${count}${nfts?.[i] ? `: ${nfts[i].name}` : ''}`}
                  aria-current={i === index % count}
                  onClick={() => setIndex(i)}
                  className="grid size-6 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={cn(
                      'size-2 rounded-full bg-primary transition-opacity',
                      i === index % count ? 'opacity-100' : 'opacity-40',
                    )}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="hidden md:block">
          {image && current ? (
            <img
              src={image.url}
              alt={image.alt || current.name}
              width={IMAGE_SIZE}
              height={IMAGE_SIZE}
              loading="eager"
              fetchPriority="high"
              className="aspect-square w-full rounded-3xl object-cover"
            />
          ) : (
            <div className="shimmer aspect-square w-full rounded-3xl" aria-hidden="true" />
          )}
        </div>
      </div>
    </section>
  )
}
