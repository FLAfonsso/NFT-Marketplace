import { Link } from '@tanstack/react-router'
import { ArrowRightIcon } from 'lucide-react'
import { CATALOG_ANCHOR } from '@/components/layout/content'
import { promoBanners, promoCta } from './content'

/** Dois banners; Explorar vai para "/" com view=new e rola até o catálogo. */
export function PromoBanners() {
  return (
    <section
      aria-label="Ofertas em destaque"
      className="mx-auto grid w-full max-w-304 gap-6 px-4 py-10 md:px-6 lg:grid-cols-2"
    >
      {promoBanners.map((banner) => (
        <article
          key={banner.id}
          className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] overflow-hidden rounded-lg bg-surface md:grid-cols-2"
        >
          <img
            src={banner.image.src}
            alt={banner.image.alt}
            width={banner.image.width}
            height={banner.image.height}
            loading="lazy"
            className="size-full min-h-44 object-cover"
          />
          <div className="flex min-w-0 flex-col items-end justify-center gap-3 p-4 text-right">
            <h3 className="text-sm font-bold md:text-base">{banner.title}</h3>
            <p className="text-xs text-muted-foreground">{banner.text}</p>
            <Link
              to="/"
              search={{ view: 'new' }}
              hash={CATALOG_ANCHOR}
              className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-primary px-4 text-xs font-bold text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {promoCta}
              <ArrowRightIcon className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </article>
      ))}
    </section>
  )
}
