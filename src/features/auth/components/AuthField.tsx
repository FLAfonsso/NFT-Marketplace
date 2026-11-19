import { useId, useState, type ComponentProps } from 'react'
import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type AuthFieldProps = Omit<ComponentProps<'input'>, 'id'> & {
  /** Rótulo acessível. Fica oculto porque o layout usa só o placeholder. */
  label: string
  error?: string
  /** Campo de senha com botão de mostrar e ocultar. */
  revealable?: boolean
}

/** Campo com label, aria-invalid e aria-describedby ligados à mensagem de erro. */
export function AuthField({ label, error, revealable, className, type, ...props }: AuthFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const [revealed, setRevealed] = useState(false)
  const inputType = revealable && revealed ? 'text' : type

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <Input
          {...props}
          id={id}
          type={inputType}
          placeholder={props.placeholder ?? label}
          aria-required="true"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'h-12 rounded-2xl border-border bg-surface px-4 text-sm placeholder:text-placeholder focus-visible:border-primary focus-visible:ring-primary/30 md:h-10 md:rounded-sm md:px-4',
            revealable && 'pr-11',
            className,
          )}
        />
        {revealable && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={revealed}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-placeholder outline-none hover:text-foreground focus-visible:text-primary"
          >
            {revealed ? <EyeIcon className="size-4" /> : <EyeOffIcon className="size-4" />}
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} className="px-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
