import { Link } from '@tanstack/react-router'
import {
  BellRingIcon,
  CircleAlertIcon,
  DownloadIcon,
  HeartIcon,
  LogOutIcon,
  MapPinIcon,
  ShoppingBasketIcon,
  UserIcon,
  type LucideIcon,
} from 'lucide-react'
import { ComingSoon } from '@/components/ComingSoon'
import { cn } from '@/lib/utils'

export type AccountSection = 'profile' | 'wallets'

interface Item {
  label: string
  icon: LucideIcon
  to?: '/profile' | '/wallets' | '/favorites'
  section?: AccountSection
}

const ITEMS: readonly Item[] = [
  { label: 'Dados do perfil', icon: UserIcon, to: '/profile', section: 'profile' },
  { label: 'Carteiras', icon: MapPinIcon, to: '/wallets', section: 'wallets' },
  { label: 'Atividade', icon: ShoppingBasketIcon },
  { label: 'Lista de interesse', icon: HeartIcon, to: '/favorites' },
  { label: 'Ofertas', icon: BellRingIcon },
  { label: 'Arquivos baixados', icon: DownloadIcon },
  { label: 'Suporte', icon: CircleAlertIcon },
]

const base =
  'relative flex items-center gap-3 text-sm text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring'
// Desktop: lista vertical com barra à esquerda. Abaixo de 1024: abas com sublinhado.
const row =
  'lg:h-[45px] lg:w-full lg:px-4 max-lg:h-11 max-lg:shrink-0 max-lg:border-b-2 max-lg:border-transparent max-lg:px-4 max-lg:whitespace-nowrap'
const activeRow =
  'font-bold lg:bg-background/20 lg:before:absolute lg:before:inset-y-0 lg:before:left-0 lg:before:w-1.5 lg:before:bg-primary max-lg:border-primary'

/** "Meu perfil": coluna lateral no desktop; lista de abas rolável no topo no mobile e no tablet. */
export function AccountNav({
  active,
  onLogout,
  loggingOut,
}: {
  active: AccountSection
  onLogout: () => void
  loggingOut: boolean
}) {
  return (
    <nav aria-label="Meu perfil" className="rounded-sm bg-surface lg:self-start">
      <h2 className="hidden px-4 pt-3 pb-2 text-lg font-bold text-foreground lg:block">Meu perfil</h2>
      <ul className="flex overflow-x-auto lg:flex-col lg:overflow-visible">
        {ITEMS.map(({ label, icon: Icon, to, section }) => {
          const current = section === active
          const content = (
            <>
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {label}
            </>
          )
          return (
            <li key={label} className="max-lg:shrink-0">
              {to ? (
                <Link
                  to={to}
                  aria-current={current ? 'page' : undefined}
                  className={cn(base, row, current && activeRow)}
                >
                  {content}
                </Link>
              ) : (
                <ComingSoon className={cn(base, row, 'rounded-none')}>{content}</ComingSoon>
              )}
            </li>
          )
        })}
        <li className="max-lg:shrink-0 lg:mt-px lg:border-t lg:border-border">
          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            aria-busy={loggingOut}
            className={cn(base, row, 'font-bold disabled:opacity-60')}
          >
            <LogOutIcon className="size-4 shrink-0" aria-hidden="true" />
            Sair
          </button>
        </li>
      </ul>
    </nav>
  )
}
