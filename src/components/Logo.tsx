import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

const sizes = {
  header: 'text-sm',
  auth: 'text-[28px]',
} as const

/** Marca em texto (tokens.md): mono bold, caixa alta, letter-spacing ~0.1em. */
export function Logo({
  size = 'header',
  className,
}: {
  size?: keyof typeof sizes
  className?: string
}) {
  return (
    <Link
      to="/"
      aria-label="Kurio, página inicial"
      className={cn(
        'font-bold tracking-[0.1em] text-foreground uppercase outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        sizes[size],
        className,
      )}
    >
      KURIO
    </Link>
  )
}
