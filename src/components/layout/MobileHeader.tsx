import { Link, useCanGoBack, useRouter, type LinkProps } from '@tanstack/react-router'
import { ArrowLeftIcon } from 'lucide-react'
import type { ReactNode } from 'react'

const backClass =
  'grid size-10 place-items-center rounded-full outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring'

/**
 * Cabeçalho mobile de página (voltar + título). Cada página o renderiza; some no desktop.
 * Sem histórico para voltar, o botão leva a `fallback` (padrão "/").
 */
export function MobileHeader({
  title,
  fallback = '/',
  actions,
}: {
  title: string
  fallback?: LinkProps['to']
  actions?: ReactNode
}) {
  const router = useRouter()
  const canGoBack = useCanGoBack()

  return (
    <div className="flex items-center gap-2 px-3 pt-3 pb-2 md:hidden">
      {canGoBack ? (
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => router.history.back()}
          className={backClass}
        >
          <ArrowLeftIcon className="size-5" aria-hidden="true" />
        </button>
      ) : (
        <Link to={fallback} aria-label="Voltar" className={backClass}>
          <ArrowLeftIcon className="size-5" aria-hidden="true" />
        </Link>
      )}
      <h1 className="flex-1 truncate text-base font-bold">{title}</h1>
      {actions}
    </div>
  )
}
