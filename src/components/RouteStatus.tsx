import { Link, useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { Button, buttonVariants } from '@/components/ui/button'
import { APP_NAME, useDocumentTitle } from '@/lib/useDocumentTitle'

export function NotFoundPage() {
  useDocumentTitle(`Página não encontrada | ${APP_NAME}`)
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <p className="text-muted-foreground">O endereço que você abriu não existe.</p>
      <Link to="/" className={buttonVariants()}>Voltar ao início</Link>
    </div>
  )
}

export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold">Algo deu errado</h1>
      <p className="text-muted-foreground">
        {error instanceof Error ? error.message : 'Erro inesperado ao abrir esta tela.'}
      </p>
      <Button
        onClick={() => {
          reset()
          void router.invalidate()
        }}
      >
        Tentar de novo
      </Button>
    </div>
  )
}
