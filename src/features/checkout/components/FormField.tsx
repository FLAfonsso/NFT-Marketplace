import { ChevronDownIcon } from 'lucide-react'
import { useId, type ComponentProps, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

const control =
  'w-full rounded-sm border border-border bg-transparent px-3 text-sm text-foreground outline-none transition-colors placeholder:text-placeholder focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:opacity-50'

interface FieldShellProps {
  label: string
  required?: boolean
  error?: string
  hint?: string
  className?: string
  /** Rótulo só para leitores de tela (o layout mostra o placeholder). */
  hideLabel?: boolean
  children: (props: {
    id: string
    'aria-invalid': true | undefined
    'aria-describedby': string | undefined
    'aria-required': true | undefined
  }) => ReactNode
}

/** Rótulo com asterisco, controle e mensagem de erro ligada por aria-describedby. */
function FieldShell({ label, required, error, hint, className, hideLabel, children }: FieldShellProps) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ')
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className={cn('text-sm', hideLabel && 'sr-only')}>
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-required">
            *
          </span>
        )}
      </label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy || undefined,
        'aria-required': required ? true : undefined,
      })}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

type Shared = Omit<FieldShellProps, 'children'>

export function TextField({
  label,
  required,
  error,
  hint,
  className,
  hideLabel,
  suffix,
  ...props
}: Shared & ComponentProps<'input'> & { suffix?: ReactNode }) {
  return (
    <FieldShell {...{ label, required, error, hint, className, hideLabel }}>
      {(a11y) => (
        <div className="flex items-stretch gap-2">
          <input {...props} {...a11y} className={cn(control, 'h-10')} />
          {suffix}
        </div>
      )}
    </FieldShell>
  )
}

export function SelectField({
  label,
  required,
  error,
  hint,
  className,
  hideLabel,
  placeholder,
  options,
  ...props
}: Shared &
  ComponentProps<'select'> & {
    placeholder: string
    options: readonly { value: string; label: string }[]
  }) {
  return (
    <FieldShell {...{ label, required, error, hint, className, hideLabel }}>
      {(a11y) => (
        <div className="relative">
          <select
            {...props}
            {...a11y}
            className={cn(
              control,
              'h-10 appearance-none bg-background pr-9 has-[option[value=""]:checked]:text-placeholder',
            )}
          >
            <option value="" disabled>
              {placeholder}
            </option>
            {options.map((o) => (
              <option key={o.value} value={o.value} className="text-foreground">
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDownIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
        </div>
      )}
    </FieldShell>
  )
}

export function TextareaField({
  label,
  required,
  error,
  hint,
  className,
  hideLabel,
  ...props
}: Shared & ComponentProps<'textarea'>) {
  return (
    <FieldShell {...{ label, required, error, hint, className, hideLabel }}>
      {(a11y) => <textarea {...props} {...a11y} className={cn(control, 'min-h-36 resize-y py-2')} />}
    </FieldShell>
  )
}
