import { LoaderCircleIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFocusOnMount } from '../useFocusOnMount'

/**
 * Pedido pendente. Sem botão de nova compra: o mesmo pedido é acompanhado até ficar terminal,
 * e recarregar a página o recupera (o id vem da URL).
 */
export function PendingView({
  orderId,
  connectionError,
  onRetry,
}: {
  orderId: string
  /** Uma releitura falhou: o estado em tela é o último conhecido. */
  connectionError: boolean
  onRetry: () => void
}) {
  const titleRef = useFocusOnMount<HTMLHeadingElement>()

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-12 md:py-16">
      <section
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-4 rounded-lg border border-border bg-surface px-6 py-10 text-center max-md:rounded-3xl"
      >
        <LoaderCircleIcon
          aria-hidden="true"
          className="size-10 animate-spin text-primary motion-reduce:animate-none"
        />
        <h1 ref={titleRef} tabIndex={-1} className="text-xl font-bold outline-none">
          Aguardando confirmação
        </h1>
        <p className="text-sm text-muted-foreground">
          Seu pedido foi enviado e estamos esperando a confirmação do pagamento. Isso costuma levar
          alguns segundos.
        </p>
        <div
          role="progressbar"
          aria-label="Aguardando confirmação do pagamento"
          className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-border"
        >
          <div className="h-full w-1/2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
        </div>
        <p className="text-sm">
          Você pode recarregar esta página: o mesmo pedido continua sendo acompanhado e nenhuma outra
          compra é criada.
        </p>
        <p className="text-xs text-muted-foreground">Pedido {orderId}</p>
      </section>

      {connectionError && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <p className="flex-1">
            Não conseguimos atualizar o estado agora. Seu pedido não foi afetado e vamos tentar de
            novo.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Tentar de novo
          </Button>
        </div>
      )}
    </div>
  )
}
