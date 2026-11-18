import { Button } from '@/components/ui/button'
import type { FormAlertState } from '../serverErrors'

/** Aviso do topo do formulário (rede, 5xx, conflito sem campo). */
export function FormAlertBox({
  alert,
  busy,
  onRetry,
}: {
  alert: FormAlertState | null
  busy: boolean
  onRetry: () => void
}) {
  if (!alert) return null
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-sm border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
    >
      <p>{alert.message}</p>
      {alert.retryable && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={onRetry}
          className="self-start border-destructive/50 bg-transparent text-destructive"
        >
          Tentar de novo
        </Button>
      )}
    </div>
  )
}
