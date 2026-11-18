import { Link, useRouterState } from '@tanstack/react-router'
import { LogInIcon, ShoppingCartIcon } from 'lucide-react'
import { ComingSoon } from '@/components/ComingSoon'
import { Logo } from '@/components/Logo'
import { useAuth } from '@/features/auth'
import { useCart } from '@/features/cart'
import { cn } from '@/lib/utils'
import { CATALOG_ANCHOR, cartLabel } from './content'
import { HeaderSearch } from './HeaderSearch'
import { UserMenu } from './UserMenu'

const navItem =
  'relative inline-flex h-9 items-center rounded-sm px-1 text-xs outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring after:absolute after:inset-x-0 after:-bottom-[5px] after:h-0.5 after:bg-transparent'
const navActive = 'font-bold text-primary after:bg-primary'

/** Mercado fica ativo em /nft/*, /cart e /checkout. */
const isMarketPath = (path: string) =>
  path.startsWith('/nft/') || path === '/cart' || path === '/checkout'

/** Header desktop (>= 768px). No mobile a navegação é a barra inferior. */
export function Header() {
  const auth = useAuth()
  const { pathname, href } = useRouterState({ select: (s) => s.location })
  const { itemCount } = useCart()
  const onAuthPage = pathname === '/login' || pathname === '/signup'

  return (
    <header className="hidden md:block">
      <div className="mx-auto max-w-[1200px] px-4">
        <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center border-b border-border">
          <Logo />

          <nav aria-label="Principal" className="flex items-center gap-8">
            <Link
              to="/"
              aria-current={pathname === '/' ? 'page' : undefined}
              className={cn(navItem, pathname === '/' && navActive)}
            >
              Início
            </Link>
            <Link
              to="/"
              hash={CATALOG_ANCHOR}
              aria-current={isMarketPath(pathname) ? 'page' : undefined}
              className={cn(navItem, isMarketPath(pathname) && navActive)}
            >
              Mercado
            </Link>
            <ComingSoon className={navItem}>Criadores</ComingSoon>
            <ComingSoon className={navItem}>Aprenda</ComingSoon>
          </nav>

          <div className="flex items-center justify-end gap-3">
            <HeaderSearch />
            <Link
              to="/cart"
              aria-label={cartLabel(itemCount)}
              className="relative grid size-8 place-items-center rounded-sm outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ShoppingCartIcon className="size-4" aria-hidden="true" />
              {itemCount !== undefined && (
                <span
                  data-testid="cart-badge"
                  aria-hidden="true"
                  className="absolute -top-0.5 -right-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 font-bold text-primary-foreground"
                >
                  {itemCount}
                </span>
              )}
            </Link>
            {auth.status === 'authenticated' ? (
              <UserMenu />
            ) : auth.status === 'loading' ? (
              <span aria-hidden="true" className="h-7 w-20" />
            ) : (
              <Link
                to="/login"
                search={{ redirect: onAuthPage ? undefined : href }}
                className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-primary px-2.5 text-xs font-bold text-primary outline-none hover:bg-primary hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <LogInIcon className="size-3.5" aria-hidden="true" />
                Entrar
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
