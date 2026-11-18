import { useId, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import type { Cart, Quote } from '@/contracts'
import { Bone, CouponForm, itemKey, type CartLine } from '@/features/cart'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

function Row({ label, children, note, strong }: { label: string; children: ReactNode; note?: string; strong?: boolean }) {
  return (
    // No mobile o Total fica só no painel fixo com "Confirmar compra".
    <div className={cn('flex flex-col', strong && 'mt-2 border-t border-border pt-3 max-md:hidden')}>
      <div className="flex min-h-7 items-center justify-between gap-3">
        <dt className={cn('text-sm', strong && 'font-bold')}>{label}</dt>
        <dd className={cn('text-right', strong ? 'text-lg font-bold text-primary' : 'text-base')}>{children}</dd>
      </div>
      {note && <p className="text-center text-[11px] text-primary">{note}</p>}
    </div>
  )
}

export function SummarySkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex h-[72px] items-center gap-3 rounded-sm bg-surface p-1.5">
          <Bone className="shimmer-strong size-[60px] shrink-0 rounded-sm" />
          <div className="flex flex-1 flex-col gap-2">
            <Bone className="shimmer-strong h-4 w-2/3" />
            <Bone className="shimmer-strong h-3 w-1/2" />
          </div>
          <Bone className="shimmer-strong mr-2 h-5 w-16" />
        </div>
      ))}
      <Bone className="mt-2 h-4 w-3/4 self-center" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex justify-between py-1.5">
          <Bone className="h-4 w-24" />
          <Bone className="h-4 w-20" />
        </div>
      ))}
    </div>
  )
}

/**
 * "Seus NFTs": linhas da cotação (POST /quote), cupom (mesmo componente do carrinho) e
 * Subtotal, Desconto, Taxa de rede e Total, todos da API.
 */
export function OrderSummary({
  cart,
  quote,
  lines,
  loading,
  updating,
  failed,
  onRetry,
  locked,
}: {
  cart: Cart | undefined
  quote: Quote | undefined
  lines: readonly CartLine[]
  loading: boolean
  updating: boolean
  failed: boolean
  onRetry: () => void
  /** Pedido em envio: cupom travado. */
  locked: boolean
}) {
  const titleId = useId()
  const couponId = useId()
  const [couponOpen, setCouponOpen] = useState(false)
  const byKey = new Map(lines.map((l) => [l.key, l]))
  const showCoupon = couponOpen || !!cart?.couponCode

  return (
    <section aria-labelledby={titleId} aria-busy={loading || updating} className="flex flex-col gap-3">
      <h2 id={titleId} className="font-bold">
        Seus NFTs
      </h2>

      {loading || !cart ? (
        <SummarySkeleton />
      ) : (
        <>
          <div aria-hidden="true" className="hidden justify-between text-sm font-bold md:flex">
            <span>NFTs</span>
            <span>Subtotal</span>
          </div>
          <ul aria-label="Itens do pedido" className={cn('flex flex-col gap-2 transition-opacity', updating && 'opacity-60')}>
            {(quote?.items ?? []).map((line) => {
              const cartLine = byKey.get(itemKey(line))
              const nft = cartLine?.nft
              return (
                <li key={itemKey(line)} className="flex items-center gap-3 rounded-sm bg-surface p-1.5 pr-4">
                  {nft ? (
                    <img src={nft.gallery[0]?.url} alt="" width={60} height={60} className="size-[60px] shrink-0 rounded-sm object-cover" />
                  ) : (
                    <Bone className="shimmer-strong size-[60px] shrink-0 rounded-sm" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{nft?.name ?? 'Carregando…'}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {nft ? `ID do token: #${nft.tokenId}` : ' '}
                      {cartLine?.edition && ` · Edição ${cartLine.edition.name}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    <span aria-hidden="true">(x {line.quantity})</span>
                    <span className="sr-only">Quantidade {line.quantity}</span>
                  </span>
                  <span className="shrink-0 font-bold text-primary">{formatEth(line.lineTotal)} ETH</span>
                </li>
              )
            })}
          </ul>

          <fieldset disabled={locked} className="flex flex-col gap-2">
            <legend className="sr-only">Cupom</legend>
            {!cart.couponCode && (
              <button
                type="button"
                aria-expanded={showCoupon}
                aria-controls={couponId}
                onClick={() => setCouponOpen((v) => !v)}
                className="self-center rounded-sm text-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                Tem um código promocional? <span className="text-primary">Aplique aqui</span>
              </button>
            )}
            <div id={couponId} hidden={!showCoupon}>
              {showCoupon && <CouponForm cart={cart} quote={quote} />}
            </div>
          </fieldset>

          {failed ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">
              Não foi possível cotar o pedido.
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                Tentar de novo
              </Button>
            </div>
          ) : (
            quote && (
              <dl className={cn('flex flex-col transition-opacity', updating && 'opacity-60')}>
                <Row label="Subtotal">{formatEth(quote.subtotal)} ETH</Row>
                <Row label="Desconto do lançamento">(-) {formatEth(quote.discount)} ETH</Row>
                <Row label="Taxa de rede" note="Taxa estimada">
                  {formatEth(quote.networkFee)} ETH
                </Row>
                <Row label="Total" strong>
                  {formatEth(quote.total)} ETH
                </Row>
              </dl>
            )
          )}
        </>
      )}
    </section>
  )
}
