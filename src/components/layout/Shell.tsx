import { Outlet, useRouterState } from '@tanstack/react-router'
import { useIsDesktop } from '@/lib/useMediaQuery'
import { Footer } from './Footer'
import { Header } from './Header'
import { MobileNav } from './MobileNav'

export const MAIN_ID = 'conteudo'

const AUTH_PATHS = new Set(['/login', '/signup'])

/**
 * Layout raiz: header, conteúdo e rodapé em todas as rotas. Exceção: /login e /signup no mobile,
 * que são página cheia. Header e rodapé aparecem só no desktop; a barra inferior, só no mobile.
 */
export function Shell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isDesktop = useIsDesktop()

  if (!isDesktop && AUTH_PATHS.has(pathname)) return <Outlet />

  // Detalhe do NFT, carrinho e pagamento têm o próprio painel inferior no mobile.
  const hideMobileNav =
    !isDesktop && (pathname.startsWith('/nft/') || pathname === '/cart' || pathname === '/checkout')

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href={`#${MAIN_ID}`}
        onClick={(event) => {
          event.preventDefault()
          document.getElementById(MAIN_ID)?.focus()
        }}
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-50 focus-visible:rounded-sm focus-visible:bg-primary focus-visible:px-3 focus-visible:py-2 focus-visible:text-sm focus-visible:font-bold focus-visible:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        Ir para o conteúdo
      </a>
      <Header />
      <main id={MAIN_ID} tabIndex={-1} className="flex-1 pb-24 outline-none md:pb-0">
        <Outlet />
      </main>
      <Footer />
      {!hideMobileNav && <MobileNav />}
    </div>
  )
}
