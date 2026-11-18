import { Link } from '@tanstack/react-router'
import { ShoppingCartIcon } from 'lucide-react'
import type { Ref } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { isApiRequestError } from '@/lib/api'
import { cn } from '@/lib/utils'

/** Carrinho vazio com chamada para explorar. O título recebe o foco depois de remover o último item. */
export function CartEmpty({ headingRef }: { headingRef: Ref<HTMLHeadingElement> }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl bg-surface px-6 py-16 text-center md:rounded-lg">
      <ShoppingCartIcon className="size-10 text-primary" aria-hidden="true" />
      <h2 ref={headingRef} tabIndex={-1} className="text-lg font-bold outline-none">
        Seu carrinho está vazio
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Encontre NFTs de colecionadores e criadores e adicione ao carrinho para ver o resumo aqui.
      </p>
      <Link to="/" className={cn(buttonVariants(), 'h-10 rounded-sm px-6 font-bold')}>
        Explorar NFTs
      </Link>
    </div>
  )
}

/** Falha ao carregar o carrinho, com nova tentativa. */
export function CartError({
  error,
  retrying,
  onRetry,
}: {
  error: unknown
  retrying: boolean
  onRetry: () => void
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 bg-surface p-4"
    >
      <p className="font-bold text-destructive">Não foi possível carregar o carrinho.</p>
      <p className="text-sm text-muted-foreground">
        {isApiRequestError(error) ? error.message : 'Ocorreu um erro inesperado.'}
      </p>
      <Button disabled={retrying} onClick={onRetry}>
        {retrying ? 'Tentando…' : 'Tentar de novo'}
      </Button>
    </div>
  )
}
