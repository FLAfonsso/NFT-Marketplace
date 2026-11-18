import { Link } from '@tanstack/react-router'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { useFocusOnMount } from '../useFocusOnMount'

/** Carregando o pedido (1ª leitura). Sem dados do pedido, só formas. */
export function OrderSkeleton() {
  return (
    <div
      aria-busy="true"
      className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-4 py-12 md:py-16"
    >
      <span className="sr-only">Carregando pedido…</span>
      <div aria-hidden="true" className="flex w-full flex-col items-center gap-4 rounded-lg bg-surface px-6 py-10">
        <Skeleton className="size-10 rounded-full" />
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-full max-w-sm" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  )
}

/**
 * 404 ou 403: o mesmo texto para os dois, sem dizer se o pedido existe nem de quem é, e sem
 * nenhum dado do pedido.
 */
export function OrderDeniedView() {
  const titleRef = useFocusOnMount<HTMLHeadingElement>()
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-start gap-4 px-4 py-16">
      <h1 ref={titleRef} tabIndex={-1} className="text-2xl font-bold outline-none">
        Pedido não encontrado
      </h1>
      <p className="text-muted-foreground">
        Este pedido não existe ou não está disponível para a sua conta.
      </p>
      <Link to="/" className={cn(buttonVariants(), 'font-bold')}>
        Voltar ao início
      </Link>
    </div>
  )
}

/** Falha ao ler o pedido pela primeira vez (rede ou serviço). */
export function OrderLoadError({ onRetry }: { onRetry: () => void }) {
  const titleRef = useFocusOnMount<HTMLHeadingElement>()
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-start gap-4 px-4 py-16">
      <h1 ref={titleRef} tabIndex={-1} className="text-2xl font-bold outline-none">
        Confirmação do pedido
      </h1>
      <div
        role="alert"
        className="flex w-full flex-wrap items-center gap-3 rounded-sm border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
      >
        <p className="flex-1">
          Não foi possível carregar o pedido. Verifique sua conexão. Tentar de novo não cria outra
          compra.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Tentar de novo
        </Button>
      </div>
    </div>
  )
}
