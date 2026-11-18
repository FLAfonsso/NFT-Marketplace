import type { ComponentProps, MouseEvent } from 'react'
import { notifyUnavailable } from '@/lib/unavailable'
import { cn } from '@/lib/utils'

type ComingSoonProps = Omit<ComponentProps<'a'>, 'href' | 'onClick' | 'ref'> & { as?: 'link' | 'button' }

/**
 * Recurso fora do escopo: visível, aria-disabled, não navega e avisa "Indisponível nesta versão".
 * Continua focável (aria-disabled, não disabled) para quem navega por teclado ouvir o aviso.
 */
export function ComingSoon({ as = 'link', className, children, ...props }: ComingSoonProps) {
  const onClick = (event: MouseEvent) => {
    event.preventDefault()
    notifyUnavailable()
  }
  const classes = cn(
    'cursor-not-allowed rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
    className,
  )

  if (as === 'button') {
    return (
      <button
        {...(props as ComponentProps<"button">)}
        type="button"
        aria-disabled="true"
        onClick={onClick}
        className={classes}
      >
        {children}
      </button>
    )
  }
  return (
    <a
      {...(props as ComponentProps<'a'>)}
      href="#"
      aria-disabled="true"
      onClick={onClick}
      className={classes}
    >
      {children}
    </a>
  )
}
