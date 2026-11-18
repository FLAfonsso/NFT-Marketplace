import { Button } from '@/components/ui/button'
import { isApiRequestError } from '@/lib/api'

/** Falha ao carregar os dados da tela (rede, 5xx), com nova tentativa. */
export function QueryError({
  what,
  error,
  retrying,
  onRetry,
}: {
  what: string
  error: unknown
  retrying: boolean
  onRetry: () => void
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 bg-surface p-4"
    >
      <p className="font-bold text-destructive">Não foi possível carregar {what}.</p>
      <p className="text-sm text-muted-foreground">
        {isApiRequestError(error) ? error.message : 'Ocorreu um erro inesperado.'}
      </p>
      <Button disabled={retrying} onClick={onRetry}>
        {retrying ? 'Tentando…' : 'Tentar de novo'}
      </Button>
    </div>
  )
}
