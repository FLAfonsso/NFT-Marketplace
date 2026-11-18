import { Link } from '@tanstack/react-router'
import { ComingSoon } from '@/components/ComingSoon'
import { Logo } from '@/components/Logo'
import { notifyUnavailable } from '@/lib/unavailable'
import {
  CATALOG_ANCHOR,
  compatibleWallets,
  contactStrip,
  copyright,
  footerCollections,
  footerColumns,
  footerHighlights,
  newsletter,
  socialLinks,
} from './content'

const linkClass =
  'text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline'
const headingClass = 'mb-3 text-sm font-bold text-foreground'

/** Rodapé (só desktop). Tudo fora do escopo usa ComingSoon. */
export function Footer() {
  return (
    <footer className="hidden pt-16 pb-6 md:block">
      <div className="mx-auto max-w-[1200px] px-4">
        <div className="overflow-hidden rounded-sm bg-surface">
          <div className="grid grid-cols-4 gap-0 px-8 py-8">
            {footerHighlights.map((item) => (
              <section key={item.title} className="border-r border-primary/60 px-6 first:pl-0">
                <span
                  aria-hidden="true"
                  className="mb-4 grid size-14 place-items-center rounded-full bg-primary text-xl font-bold text-primary-foreground"
                >
                  {item.letter}
                </span>
                <h2 className="mb-2 text-sm font-bold">{item.title}</h2>
                <p className="text-[11px] leading-relaxed text-muted-foreground">{item.text}</p>
              </section>
            ))}

            <section aria-labelledby="newsletter-title" className="pl-6">
              <h2 id="newsletter-title" className="mb-3 text-sm leading-tight font-bold">
                {newsletter.title}
              </h2>
              {/* Fora do escopo: o Enviar nunca finge sucesso. */}
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  notifyUnavailable()
                }}
                className="mb-3 flex"
              >
                <input
                  type="email"
                  aria-label={newsletter.label}
                  placeholder={newsletter.placeholder}
                  className="h-8 min-w-0 flex-1 rounded-l-sm bg-surface-strong px-2 text-[11px] text-foreground outline-none placeholder:text-placeholder focus-visible:ring-2 focus-visible:ring-ring"
                />
                <ComingSoon
                  as="button"
                  className="h-8 rounded-r-sm bg-primary px-3 text-xs font-bold text-primary-foreground"
                >
                  {newsletter.submit}
                </ComingSoon>
              </form>
              <p className="text-[11px] leading-relaxed text-muted-foreground">{newsletter.text}</p>
            </section>
          </div>

          <div className="grid grid-cols-4 items-center bg-surface-strong px-8 py-5 text-[11px]">
            <Logo />
            <p className="col-span-1">{contactStrip.tagline}</p>
            <p>{contactStrip.email}</p>
            <p>{contactStrip.phone}</p>
          </div>

          <div className="grid grid-cols-4 gap-6 px-8 pt-8 pb-10">
            {footerColumns.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <h2 className={headingClass}>{column.title}</h2>
                <ul className="flex flex-col gap-2">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {link.to ? (
                        <Link to={link.to} className={linkClass}>
                          {link.label}
                        </Link>
                      ) : (
                        <ComingSoon className={linkClass}>{link.label}</ComingSoon>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}

            <nav aria-label="Coleções">
              <h2 className={headingClass}>Coleções</h2>
              <ul className="flex flex-col gap-2">
                {footerCollections.map((collection) => (
                  <li key={collection.id}>
                    <Link
                      to="/"
                      search={{ collections: [collection.id] }}
                      hash={CATALOG_ANCHOR}
                      className={linkClass}
                    >
                      {collection.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div>
              <h2 className={headingClass}>Redes sociais</h2>
              <ul className="mb-6 flex gap-2">
                {socialLinks.map((social) => (
                  <li key={social.name}>
                    <ComingSoon
                      aria-label={`${social.name} (indisponível nesta versão)`}
                      className="grid size-6 place-items-center rounded-sm border border-primary text-[10px] font-bold text-primary hover:bg-primary hover:text-primary-foreground"
                    >
                      {social.short}
                    </ComingSoon>
                  </li>
                ))}
              </ul>
              <h2 className={headingClass}>Carteiras compatíveis</h2>
              <ul className="flex flex-wrap gap-x-2 gap-y-1 rounded-sm bg-surface-strong px-2 py-1.5 text-[8px] tracking-wide text-primary">
                {compatibleWallets.map((wallet, index) => (
                  <li key={wallet}>
                    {index > 0 && (
                      <span aria-hidden="true" className="mr-2">
                        ·
                      </span>
                    )}
                    {wallet}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">{copyright}</p>
      </div>
    </footer>
  )
}
