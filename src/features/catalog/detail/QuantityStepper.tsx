import { MinusIcon, PlusIcon } from 'lucide-react'
import { useId } from 'react'
import { cn } from '@/lib/utils'

const round =
  'grid place-items-center rounded-full bg-primary text-primary-foreground outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40'

/** Quantidade inteira, mínimo 1 e máximo `max`. Ao chegar no máximo avisa "Limite de N unidades". */
export function QuantityStepper({
  value,
  max,
  onChange,
  disabled,
  compact,
  className,
  context,
}: {
  value: number
  max: number
  onChange: (value: number) => void
  disabled?: boolean
  /** Barra inferior mobile: botões menores. */
  compact?: boolean
  className?: string
  /** Identifica o item no nome acessível dos botões (ex.: "Cosmic Bloom #118 (edição 1/10)"). */
  context?: string
}) {
  const messageId = useId()
  const suffix = context ? ` de ${context}` : ''
  const atLimit = !disabled && value >= max
  const size = compact ? 'size-6' : 'size-9'
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div role="group" aria-label="Quantidade" className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Diminuir quantidade${suffix}`}
          disabled={disabled || value <= 1}
          onClick={() => onChange(value - 1)}
          className={cn(round, size)}
        >
          <MinusIcon className="size-4" aria-hidden="true" />
        </button>
        <output aria-live="polite" className="min-w-6 text-center text-sm font-bold">
          {value}
        </output>
        <button
          type="button"
          aria-label={`Aumentar quantidade${suffix}`}
          aria-describedby={atLimit ? messageId : undefined}
          disabled={disabled || value >= max}
          onClick={() => onChange(value + 1)}
          className={cn(round, size)}
        >
          <PlusIcon className="size-4" aria-hidden="true" />
        </button>
      </div>
      <p id={messageId} role="status" className="min-h-4 text-[11px] text-muted-foreground">
        {atLimit ? `Limite de ${max} ${max === 1 ? 'unidade' : 'unidades'}` : ''}
      </p>
    </div>
  )
}
