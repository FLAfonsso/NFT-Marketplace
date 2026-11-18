import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { isApiRequestError } from '@/lib/api'

/** 404: página de erro com saída. Rede ou 5xx: aviso com "Tentar de novo". */
export function NftDetailError({
  error,
  retrying,
  onRetry,
}: {
  error: unknown
  retrying: boolean
  onRetry: () => void
}) {
  const notFound = isApiRequestError(error) && error.status === 404

  if (notFound) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-16">
        <h1 className="text-2xl font-bold">NFT não encontrado</h1>
        <p className="text-muted-foreground">
          Este NFT não existe ou foi removido. Confira o endereço ou volte ao início para explorar o catálogo.
        </p>
        <Button nativeButton={false} render={<Link to="/" />}>
          Voltar ao início
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-16">
      <div
        role="alert"
        className="flex w-full flex-col gap-3 rounded-lg border border-destructive/40 bg-surface p-4"
      >
        <p className="font-bold text-destructive">Não foi possível carregar este NFT.</p>
        <p className="text-sm text-muted-foreground">
          {isApiRequestError(error) ? error.message : 'Ocorreu um erro inesperado.'}
        </p>
        <Button className="self-start" disabled={retrying} onClick={onRetry}>
          {retrying ? 'Tentando…' : 'Tentar de novo'}
        </Button>
      </div>
    </div>
  )
}
