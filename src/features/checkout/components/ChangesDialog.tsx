import { Link } from '@tanstack/react-router'
import { LoaderCircleIcon } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import type { CheckoutState } from '../machine'

/**
 * Mudanças entre a cotação revisada e a atual (antes e depois, em texto). O pedido só segue
 * com nova confirmação ("Confirmar novos valores"); item esgotado exige ajustar o carrinho.
 * Quando a revisão fica desatualizada em tempo real, abre já com as diferenças do evento e a
 * confirmação só libera quando a cotação nova chega.
 */
export function ChangesDialog({
  state,
  onCancel,
  onAccept,
}: {
  state: CheckoutState
  onCancel: () => void
  onAccept: () => void
}) {
  const changed = state.status === 'changed' ? state : null

  return (
    <Dialog open={changed !== null} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg bg-surface p-6 ring-border sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Os valores do pedido mudaram</DialogTitle>
          <DialogDescription>
            {changed?.reason} Nada foi cobrado. Confira antes de continuar.
          </DialogDescription>
        </DialogHeader>

        <ul aria-label="Mudanças" className="flex flex-col gap-2 text-sm">
          {changed?.changes.map((change) => (
            <li key={change.id} className="rounded-sm border border-border p-3">
              <p className="font-bold">{change.label}</p>
              <p className="text-muted-foreground">
                Antes: <span className="text-foreground line-through decoration-muted-foreground">{change.before}</span>
              </p>
              <p className="text-muted-foreground">
                Agora: <span className="font-bold text-primary">{change.after}</span>
              </p>
            </li>
          ))}
        </ul>

        <p role="status" className="flex min-h-5 items-center gap-2 text-sm">
          {changed && !changed.quote && (
            <>
              <LoaderCircleIcon className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              <span className="text-muted-foreground">Buscando a cotação atualizada…</span>
            </>
          )}
          {changed?.quote && !changed.blocking && (
            <span>
              Novo total: <strong className="text-primary">{formatEth(changed.quote.total)} ETH</strong>
            </span>
          )}
        </p>
        {changed?.blocking && (
          <p role="alert" className="text-sm text-destructive">
            Um item ficou indisponível na quantidade pedida. Ajuste o carrinho para continuar.
          </p>
        )}

        <DialogFooter className="-mx-6 -mb-6 bg-transparent px-6 pb-6">
          <Button type="button" variant="outline" onClick={onCancel}>
            Voltar e editar
          </Button>
          {changed?.blocking ? (
            <Link to="/cart" className={cn(buttonVariants(), 'font-bold')}>
              Ajustar carrinho
            </Link>
          ) : (
            <Button type="button" disabled={!changed?.quote} onClick={onAccept} className="font-bold">
              Confirmar novos valores
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
