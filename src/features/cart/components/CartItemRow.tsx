import { Trash2Icon, TriangleAlertIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import type { QuoteLine, QuoteWarning } from '@/contracts'
import { QuantityStepper } from '@/features/catalog/detail/QuantityStepper'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { useRemoveItem, useUpdateQuantity } from '../useCartItemMutations'
import type { CartRealtimeNotice } from '../useCartRealtime'
import type { CartLine } from '../useCartLines'

/** Colunas da tabela desktop: NFT, preço, quantidade, total, lixeira. Compartilhada com o cabeçalho. */
export const DESKTOP_COLUMNS =
  'grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)_40px]'

export const Bone = ({ className }: { className?: string }) => (
  <span aria-hidden="true" className={cn('shimmer block rounded-md', className)} />
)

export type QuoteState = 'ready' | 'error'

const trash =
  'grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40'

const eth = (value: string) => `${formatEth(value)} ETH`

const warningText = (warning: QuoteWarning) =>
  warning.type === 'price_changed'
    ? `Preço alterado: de ${eth(warning.previousPrice)} para ${eth(warning.currentPrice)}`
    : warning.available === 0
      ? 'Indisponível: esgotado'
      : `Indisponível: restam ${warning.available}`

const noticeText = (notice: CartRealtimeNotice) =>
  notice.type === 'price'
    ? `Preço alterado: de ${eth(notice.from)} para ${eth(notice.to)}`
    : notice.type === 'stock'
      ? `Disponibilidade reduzida: restam ${notice.to}`
      : `Quantidade ajustada de ${notice.from} para ${notice.to}`

/** Texto (não só cor) que marca o item afetado por um aviso da cotação ou do tempo real. */
function ItemNotice({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-1 text-xs font-bold text-primary">
      <TriangleAlertIcon className="size-3.5 shrink-0" aria-hidden="true" />
      {text}
    </p>
  )
}

/** Linha enquanto o NFT carrega: mesmas dimensões da linha pronta. */
export function CartRowSkeleton({ isDesktop }: { isDesktop: boolean }) {
  return isDesktop ? (
    <li aria-hidden="true" className="h-[88px] rounded-sm bg-surface p-2.5">
      <div className={cn('grid h-full items-center gap-4', DESKTOP_COLUMNS)}>
        <div className="flex items-center gap-4">
          <Bone className="shimmer-strong size-[68px] shrink-0 rounded-sm" />
          <div className="flex flex-1 flex-col gap-2">
            <Bone className="shimmer-strong h-4 w-3/4" />
            <Bone className="shimmer-strong h-3 w-1/2" />
          </div>
        </div>
        <Bone className="shimmer-strong h-4 w-16" />
        <Bone className="shimmer-strong h-6 w-24" />
        <Bone className="shimmer-strong h-4 w-16" />
        <Bone className="shimmer-strong size-6 justify-self-center" />
      </div>
    </li>
  ) : (
    <li aria-hidden="true" className="flex h-[112px] overflow-hidden rounded-3xl bg-surface">
      <Bone className="shimmer-strong w-24 shrink-0 rounded-none" />
      <div className="flex flex-1 flex-col gap-3 p-3">
        <Bone className="shimmer-strong h-4 w-3/4" />
        <Bone className="shimmer-strong h-3 w-1/2" />
        <Bone className="shimmer-strong mt-auto h-5 w-1/3" />
      </div>
    </li>
  )
}

export function CartItemRow({
  line,
  quoteLine,
  quoteState,
  warnings,
  realtime = [],
  isDesktop,
  onRemove,
  onRemoveFailed,
}: {
  line: CartLine
  quoteLine: QuoteLine | undefined
  quoteState: QuoteState
  warnings: QuoteWarning[]
  /** Mudanças recebidas em tempo real para este item. */
  realtime?: CartRealtimeNotice[]
  isDesktop: boolean
  /** Chamado ao pedir a remoção, antes da resposta (o foco é devolvido depois). */
  onRemove: (key: string) => void
  onRemoveFailed: () => void
}) {
  const { item, nft, edition, key } = line
  const update = useUpdateQuantity()
  const remove = useRemoveItem()
  const busy = update.isPending || remove.isPending
  const error = update.error ?? remove.error

  const requestRemove = () => {
    onRemove(key)
    remove.mutate(
      { nftId: item.nftId, editionId: item.editionId },
      { onError: onRemoveFailed },
    )
  }

  const removeButton = (label: string) => (
    <button
      type="button"
      aria-label={label}
      data-remove-key={key}
      disabled={busy}
      onClick={requestRemove}
      className={trash}
    >
      <Trash2Icon className="size-5" aria-hidden="true" />
    </button>
  )

  if (!nft) {
    return (
      <li className="flex items-center justify-between gap-3 rounded-sm bg-surface p-4 text-sm">
        <div role="alert" className="flex flex-wrap items-center gap-3 text-muted-foreground">
          Não foi possível carregar este item.
          <Button variant="outline" size="sm" onClick={line.retry}>
            Tentar de novo
          </Button>
        </div>
        {removeButton('Remover item do carrinho')}
      </li>
    )
  }

  const itemLabel = `${nft.name}${edition ? ` (edição ${edition.name})` : ''}`
  const max = edition ? Math.max(1, Math.min(edition.available, edition.maxPerOrder)) : item.quantity
  const unitPrice = quoteLine?.unitPrice ?? nft.price
  const cover = nft.gallery[0]

  const lineTotal: ReactNode =
    quoteState === 'error' ? (
      '—'
    ) : quoteLine && quoteLine.quantity === item.quantity ? (
      `${formatEth(quoteLine.lineTotal)} ETH`
    ) : (
      <>
        <Bone className="h-5 w-20" />
        <span className="sr-only">Atualizando</span>
      </>
    )

  const stepper = (
    <QuantityStepper
      compact
      context={itemLabel}
      value={item.quantity}
      max={max}
      disabled={busy}
      onChange={(quantity) =>
        update.mutate({ nftId: item.nftId, editionId: item.editionId, quantity })
      }
    />
  )

  const notices = [
    ...realtime.map((n) => <ItemNotice key={`rt:${n.type}`} text={noticeText(n)} />),
    ...warnings.map((w) => <ItemNotice key={w.type} text={warningText(w)} />),
  ]
  const errorMessage = error && (
    <p role="alert" className="text-xs text-destructive">
      {error.message}
    </p>
  )

  const image = (
    <img
      src={cover?.url}
      alt={cover?.alt ?? nft.name}
      className={isDesktop ? 'size-[68px] shrink-0 rounded-sm object-cover' : 'w-24 shrink-0 object-cover'}
    />
  )

  if (!isDesktop) {
    return (
      <li aria-busy={busy} className="flex min-h-[112px] overflow-hidden rounded-3xl bg-surface">
        {image}
        <div className="flex min-w-0 flex-1 flex-col gap-1 p-3 pr-2">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{nft.name}</p>
              <p className="text-xs text-muted-foreground">Edição: {edition?.name ?? '—'}</p>
            </div>
            {removeButton(`Remover ${itemLabel} do carrinho`)}
          </div>
          {notices}
          <div className="mt-auto flex items-end justify-between gap-2">
            <p className="text-base font-bold text-primary">
              <span className="sr-only">Total: </span>
              {lineTotal}
            </p>
            {stepper}
          </div>
          {errorMessage}
        </div>
      </li>
    )
  }

  return (
    <li aria-busy={busy} className="min-h-[88px] rounded-sm bg-surface p-2.5">
      <div className={cn('grid items-center gap-4', DESKTOP_COLUMNS)}>
        <div className="flex min-w-0 items-center gap-4">
          {image}
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-sm font-bold">{nft.name}</p>
            <p className="text-xs text-muted-foreground">ID do token: #{nft.tokenId}</p>
            <p className="text-xs text-muted-foreground">Edição: {edition?.name ?? '—'}</p>
          </div>
        </div>
        <p className="text-sm font-bold text-primary">
          <span className="sr-only">Preço: </span>
          {formatEth(unitPrice)} ETH
        </p>
        <div>{stepper}</div>
        <p className="text-sm font-bold text-primary">
          <span className="sr-only">Total: </span>
          {lineTotal}
        </p>
        {removeButton(`Remover ${itemLabel} do carrinho`)}
      </div>
      {(notices.length > 0 || errorMessage) && (
        <div className="mt-1 flex flex-col gap-1 pl-[84px]">
          {notices}
          {errorMessage}
        </div>
      )}
    </li>
  )
}
