import { Link, useNavigate } from '@tanstack/react-router'
import { XIcon } from 'lucide-react'
import { useRef, type ReactNode } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import type { Order } from '@/contracts'
import { NETWORK_LABELS, shortAddress } from '@/features/checkout/labels'
import { formatEth } from '@/lib/eth'
import { useIsDesktop } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import { formatReceiptDate, hasDiscount, safeExplorerUrl, shortHash, tokenLabel } from '../format'
import { useFocusOnMount } from '../useFocusOnMount'
import { trapTab, useInertRoot } from '../useModalIsolation'

const TITLE = 'Seus NFTs agora estão na sua carteira'
const titleClass = 'text-center text-base font-bold text-muted-foreground outline-none'

function Meta({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 px-4 first:pl-0 last:pr-0 max-md:px-0 md:border-l md:border-primary md:first:border-l-0">
      <dt className={cn('text-xs', strong ? 'font-bold' : 'font-normal', 'text-muted-foreground')}>{label}</dt>
      <dd className="text-xs break-words text-muted-foreground">{children}</dd>
    </div>
  )
}

/**
 * Recibo: tudo vem do snapshot do pedido (valores gravados na compra), nunca do catálogo atual.
 * `title` é o título da tela (DialogTitle no modal, h1 na página).
 */
function Receipt({ order, title }: { order: Order; title: ReactNode }) {
  const { snapshot, transactionRef } = order
  const explorerUrl = transactionRef ? safeExplorerUrl(transactionRef.explorerUrl) : null

  return (
    <>
      <header className="flex flex-col items-center gap-3 px-6 pt-6 pb-4">
        <img
          src="/assets/tyou.png"
          alt="Envelope com a mensagem Thank you"
          width={72}
          height={80}
          className="h-20 w-auto"
        />
        {title}
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-primary px-6 py-3 md:grid-cols-[auto_auto_auto_1fr] md:gap-x-0">
        <Meta label="ID da transação" strong>
          {transactionRef ? (
            <span title={transactionRef.hash}>{shortHash(transactionRef.hash)}</span>
          ) : (
            '—'
          )}
        </Meta>
        <Meta label="Data">{formatReceiptDate(order.updatedAt)}</Meta>
        <Meta label="Total">{formatEth(snapshot.total)} ETH</Meta>
        <Meta label="Carteira" strong>
          <span title={snapshot.walletAddress}>{shortAddress(snapshot.walletAddress)}</span>
          {' · '}
          {NETWORK_LABELS[snapshot.network]}
        </Meta>
      </dl>

      <div className="flex flex-col gap-3 px-6 py-5">
        <table className="w-full border-separate border-spacing-y-0 text-sm">
          <caption className="pb-2 text-left font-bold">Detalhes da transação</caption>
          <thead>
            <tr className="text-left font-bold">
              <th scope="col" className="border-b border-border pb-2 font-bold">
                NFTs
              </th>
              <th scope="col" className="border-b border-border pb-2 text-center font-bold">
                Edições
              </th>
              <th scope="col" className="border-b border-border pb-2 text-right font-bold">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {snapshot.items.map((item) => (
              <tr key={`${item.nftId}:${item.editionId}`}>
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-3">
                    <img
                      src={item.imageUrl}
                      alt=""
                      width={56}
                      height={56}
                      className="size-12 shrink-0 rounded-sm object-cover md:size-14"
                    />
                    <div className="min-w-0">
                      <p className="font-bold break-words">{item.nftName}</p>
                      <p className="text-xs text-muted-foreground">ID do token: {tokenLabel(item)}</p>
                    </div>
                  </div>
                </td>
                <td className="px-1 text-center whitespace-nowrap text-muted-foreground">
                  <span aria-hidden="true">(x {item.quantity})</span>
                  <span className="sr-only">Quantidade {item.quantity}</span>
                </td>
                <td className="pl-2 text-right font-bold whitespace-nowrap text-primary">
                  {formatEth(item.lineTotal)} ETH
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="flex flex-col gap-1 self-end text-right text-sm md:w-3/5">
          {hasDiscount(snapshot.discount) && (
            <>
              <TotalRow label="Subtotal">{formatEth(snapshot.subtotal)} ETH</TotalRow>
              <TotalRow label={snapshot.couponCode ? `Desconto (${snapshot.couponCode})` : 'Desconto'}>
                (-) {formatEth(snapshot.discount)} ETH
              </TotalRow>
            </>
          )}
          <TotalRow label="Taxa de rede">{formatEth(snapshot.networkFee)} ETH</TotalRow>
          <TotalRow label="Total" strong>
            {formatEth(snapshot.total)} ETH
          </TotalRow>
        </dl>

        <p className="border-t border-border pt-3 text-center text-xs leading-relaxed text-muted-foreground">
          Transação confirmada na {NETWORK_LABELS[snapshot.network]}. A propriedade foi transferida
          para sua carteira conectada e registrada na rede.
        </p>

        {explorerUrl && (
          <div className="flex flex-col items-center gap-1">
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants(), 'h-11 rounded-sm px-6 font-bold')}
            >
              Ver no Etherscan
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
            <p className="text-xs text-muted-foreground">Referência simulada, não é uma transação real.</p>
          </div>
        )}
      </div>
    </>
  )
}

function TotalRow({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className={cn(strong && 'font-bold')}>{label}</dt>
      <dd className={cn(strong && 'font-bold text-primary')}>{children}</dd>
    </div>
  )
}

/** Fechar: link para o início (um link de verdade, sem role="button"). */
function CloseLink() {
  return (
    <Link
      to="/"
      aria-label="Fechar e ir para o início"
      className={cn(
        buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
        'absolute top-3 right-3 text-primary',
      )}
    >
      <XIcon aria-hidden="true" />
    </Link>
  )
}

/** Desktop: modal centrado (foco preso, Esc e fundo fecham). Fechar leva ao início. */
function ReceiptDialog({ order }: { order: Order }) {
  const navigate = useNavigate()
  const titleRef = useRef<HTMLHeadingElement>(null)
  useInertRoot()

  return (
    <>
      {/* Fundo escuro liso do layout, sob o overlay do diálogo (z-50). */}
      <div aria-hidden="true" className="fixed inset-0 z-40 bg-background" />
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) void navigate({ to: '/' })
        }}
      >
        <DialogContent
          initialFocus={titleRef}
          onKeyDown={trapTab}
          showCloseButton={false}
          className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto rounded-lg border-b-8 border-primary bg-surface p-0 ring-border sm:max-w-[578px]"
        >
          <CloseLink />
          <Receipt
            order={order}
            title={
              <DialogTitle ref={titleRef} tabIndex={-1} className={titleClass}>
                {TITLE}
              </DialogTitle>
            }
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Mobile: página com o mesmo conteúdo. */
function ReceiptPage({ order }: { order: Order }) {
  const titleRef = useFocusOnMount<HTMLHeadingElement>()
  return (
    <div className="px-4 pt-6 pb-28">
      <div className="relative overflow-hidden rounded-3xl border-b-8 border-primary bg-surface">
        <CloseLink />
        <Receipt
          order={order}
          title={
            <h1 ref={titleRef} tabIndex={-1} className={titleClass}>
              {TITLE}
            </h1>
          }
        />
      </div>
    </div>
  )
}

/** Confirmação: só é renderizada para pedido confirmado. */
export function ReceiptView({ order }: { order: Order }) {
  const isDesktop = useIsDesktop()
  return isDesktop ? <ReceiptDialog order={order} /> : <ReceiptPage order={order} />
}
