import { Link, useRouterState } from '@tanstack/react-router'
import { HeartIcon, HouseIcon, ScanLineIcon, ShoppingCartIcon, UserIcon } from 'lucide-react'
import { ComingSoon } from '@/components/ComingSoon'
import { useCart } from '@/features/cart'
import { cn } from '@/lib/utils'
import { cartLabel } from './content'

const item =
  'relative grid size-11 place-items-center rounded-full text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** Barra inferior fixa (< 768px). Perfil leva a /profile, que pede login. */
export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { itemCount } = useCart()
  const current = (path: string) => (pathname === path ? 'page' : undefined)
  const on = (path: string) => pathname === path && 'text-primary'

  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div className="relative flex h-16 items-center justify-between rounded-t-[28px] border-t border-border bg-surface px-7 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center gap-5">
          <Link to="/" aria-label="Início" aria-current={current('/')} className={cn(item, on('/'))}>
            <HouseIcon className="size-5" aria-hidden="true" />
          </Link>
          <Link
            to="/favorites"
            aria-label="Favoritos"
            aria-current={current('/favorites')}
            className={cn(item, on('/favorites'))}
          >
            <HeartIcon className="size-5" aria-hidden="true" />
          </Link>
        </div>

        <ComingSoon
          as="button"
          aria-label="Escanear (indisponível nesta versão)"
          className="absolute -top-6 left-1/2 grid size-14 -translate-x-1/2 place-items-center rounded-full border-4 border-background bg-linear-to-b from-primary to-[#B27A47] text-primary-foreground"
        >
          <ScanLineIcon className="size-6" aria-hidden="true" />
        </ComingSoon>

        <div className="flex items-center gap-5">
          <Link
            to="/cart"
            aria-label={cartLabel(itemCount)}
            aria-current={current('/cart')}
            className={cn(item, on('/cart'))}
          >
            <ShoppingCartIcon className="size-5" aria-hidden="true" />
            {!!itemCount && (
              <span
                aria-hidden="true"
                className="absolute top-0.5 right-0 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 font-bold text-primary-foreground"
              >
                {itemCount}
              </span>
            )}
          </Link>
          <Link
            to="/profile"
            aria-label="Perfil"
            aria-current={current('/profile')}
            className={cn(item, on('/profile'))}
          >
            <UserIcon className="size-5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </nav>
  )
}
