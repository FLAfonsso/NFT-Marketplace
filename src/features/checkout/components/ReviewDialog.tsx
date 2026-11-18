import { LoaderCircleIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatEth } from '@/lib/eth'
import { NETWORK_LABELS, shortAddress } from '../labels'
import type { CheckoutState, ReviewSnapshot } from '../machine'

type DialogState = Extract<CheckoutState, { status: 'reviewing' | 'revalidating' | 'submitting' | 'failed' }>

const isReviewDialogState = (state: CheckoutState): state is DialogState =>
  state.status === 'reviewing' ||
  state.status === 'revalidating' ||
  state.status === 'submitting' ||
  (state.status === 'failed' && state.error.kind !== 'validation')

function progressText(state: DialogState) {
  if (state.status === 'revalidating') return 'Conferindo preço, disponibilidade, cupom e taxas…'
  if (state.status === 'submitting') {
    return state.attempt > 0 ? 'Verificando seu pedido...' : 'Enviando pedido…'
  }
  return ''
}

function ReviewDetails({ review, nameOf }: { review: ReviewSnapshot; nameOf: (line: { nftId: string; editionId: string }) => string }) {
  const { quote, wallet } = review
  return (
    <div className="flex flex-col gap-4 text-sm">
      <section aria-label="Itens">
        <ul className="flex flex-col gap-1.5">
          {quote.items.map((line) => (
            <li key={`${line.nftId}:${line.editionId}`} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">
                {nameOf(line)} <span className="text-muted-foreground">(x {line.quantity})</span>
              </span>
              <span className="shrink-0">{formatEth(line.lineTotal)} ETH</span>
            </li>
          ))}
        </ul>
      </section>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-border pt-3">
        <dt className="text-muted-foreground">Carteira</dt>
        <dd className="text-right">
          {wallet.nickname} ({shortAddress(wallet.address)}) via {review.provider}
        </dd>
        <dt className="text-muted-foreground">Rede</dt>
        <dd className="text-right">{NETWORK_LABELS[review.network]}</dd>
        {quote.coupon?.status === 'applied' && (
          <>
            <dt className="text-muted-foreground">Cupom</dt>
            <dd className="text-right">{quote.coupon.code}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd className="text-right">{formatEth(quote.subtotal)} ETH</dd>
        <dt className="text-muted-foreground">Desconto</dt>
        <dd className="text-right">(-) {formatEth(quote.discount)} ETH</dd>
        <dt className="text-muted-foreground">Taxa de rede</dt>
        <dd className="text-right">{formatEth(quote.networkFee)} ETH</dd>
        <dt className="font-bold">Total</dt>
        <dd className="text-right text-lg font-bold text-primary">{formatEth(quote.total)} ETH</dd>
      </dl>
    </div>
  )
}

/**
 * Revisão antes do envio (Dialog com foco preso). Só "Enviar pedido" avança. Durante a
 * revalidação e o envio o diálogo não fecha e mostra o progresso em role="status"; falhas
 * aparecem aqui em role="alert", com "Tentar de novo" quando faz sentido.
 */
export function ReviewDialog({
  state,
  nameOf,
  onCancel,
  onSend,
  onRetry,
}: {
  state: CheckoutState
  nameOf: (line: { nftId: string; editionId: string }) => string
  onCancel: () => void
  onSend: () => void
  onRetry: () => void
}) {
  const open = isReviewDialogState(state)
  const busy = state.status === 'revalidating' || state.status === 'submitting'
  const review = open ? state.review : null
  const failed = state.status === 'failed' ? state.error : null
  const retryable =
    failed !== null &&
    (failed.kind === 'transient' || failed.kind === 'unverified' || failed.kind === 'revalidation')

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onCancel()
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg bg-surface p-6 ring-border sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            {review ? 'Revise seu pedido' : 'Verificando seu pedido'}
          </DialogTitle>
          <DialogDescription>
            {review
              ? 'Confira itens, carteira, rede e total. Antes do envio, os valores são conferidos de novo.'
              : 'Um envio anterior ficou sem resposta. Estamos recuperando o mesmo pedido, sem criar outro.'}
          </DialogDescription>
        </DialogHeader>

        {open && review && <ReviewDetails review={review} nameOf={nameOf} />}

        <p role="status" className="flex min-h-5 items-center gap-2 text-sm text-muted-foreground">
          {busy && <LoaderCircleIcon className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {open ? progressText(state) : ''}
        </p>

        {failed && (
          <div role="alert" className="flex flex-col gap-1 rounded-sm border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <p>{failed.message}</p>
            <p className="text-xs text-muted-foreground">Seu carrinho e seus dados continuam salvos.</p>
          </div>
        )}

        <DialogFooter className="-mx-6 -mb-6 bg-transparent px-6 pb-6">
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            Voltar e editar
          </Button>
          {failed && retryable ? (
            <Button type="button" onClick={onRetry} className="font-bold">
              Tentar de novo
            </Button>
          ) : (
            review && (
              <Button
                type="button"
                disabled={state.status !== 'reviewing'}
                onClick={onSend}
                className="font-bold"
              >
                {busy ? 'Enviando…' : 'Enviar pedido'}
              </Button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
