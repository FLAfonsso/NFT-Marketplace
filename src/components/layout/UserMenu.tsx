import { Link } from '@tanstack/react-router'
import { ChevronDownIcon, LogOutIcon, UserIcon, WalletIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/features/auth'

/** Autenticado: avatar + nome com menu (Perfil, Carteiras, Sair). */
export function UserMenu() {
  const auth = useAuth()
  if (auth.status !== 'authenticated') return null
  const { user } = auth

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Menu da conta de ${user.name}`}
        className="flex h-8 items-center gap-2 rounded-sm px-1.5 text-xs outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring aria-expanded:text-primary"
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="size-6 rounded-full object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-6 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground uppercase"
          >
            {user.name.charAt(0)}
          </span>
        )}
        <span className="max-w-28 truncate">{user.name}</span>
        <ChevronDownIcon className="size-3" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem render={<Link to="/profile" />}>
          <UserIcon aria-hidden="true" /> Perfil
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link to="/wallets" />}>
          <WalletIcon aria-hidden="true" /> Carteiras
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void auth.logout()}>
          <LogOutIcon aria-hidden="true" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
