import { Button } from '@/components/ui/button'
import type { FormAlert } from '../forms/applyApiError'

/** Aviso do topo do formulário (credenciais, rede, 5xx). Permite tentar de novo. */
export function FormAlertBanner({
  alert,
  onRetry,
  busy,
}: {
  alert: FormAlert | null
  onRetry: () => void
  busy: boolean
}) {
  if (!alert) return null
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
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
