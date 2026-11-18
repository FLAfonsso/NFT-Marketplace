import { Link } from '@tanstack/react-router'
import { useId, type ReactNode } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import type { Cart, Quote } from '@/contracts'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { Bone } from './CartItemRow'
import { CouponForm, CouponSkeleton } from './CouponForm'

function Row({
  label,
  children,
  note,
  strong,
}: {
  label: string
  children: ReactNode
  note?: string
  strong?: boolean
}) {
  return (
    <div className={cn('flex flex-col', strong && 'pt-2')}>
      <div className="flex min-h-7 items-center justify-between gap-3">
        <dt className={cn('text-sm', strong && 'font-bold')}>{label}</dt>
        <dd className={cn('text-right', strong ? 'text-lg font-bold text-primary' : 'text-sm')}>
          {children}
        </dd>
      </div>
      {/* Reserva a linha da nota mesmo sem texto, para o bloco não mudar de altura. */}
      {note !== undefined && (
        <p className="-mt-1 min-h-4 text-right text-[11px] text-muted-foreground">{note}</p>
      )}
    </div>
  )
}

/**
 * Resumo da carteira. Todos os valores são os da cotação da API (nunca somados aqui).
 * Sem `cart` (carregando), mostra a mesma estrutura com skeletons, para não pular o layout.
 */
export function CartSummary({
  cart,
  quote,
  quoteLoading,
  quoteUpdating,
  quoteFailed,
  onRetryQuote,
  blockReason,
  isGuest,
  isDesktop,
}: {
  cart: Cart | undefined
  quote: Quote | undefined
  /** Primeira cotação ainda não chegou. */
  quoteLoading: boolean
  /** Mostrando a cotação anterior enquanto a nova chega. */
  quoteUpdating: boolean
  quoteFailed: boolean
  onRetryQuote: () => void
  /** Motivo do botão "Conectar e finalizar" desabilitado; null quando liberado. */
  blockReason: string | null
  isGuest: boolean
  isDesktop: boolean
}) {
  const titleId = useId()
  const reasonId = useId()
  const loading = !cart
  const showBone = loading || (quoteLoading && !quote)
  const money = (value: string | undefined, prefix = '') =>
    showBone ? (
      <>
        <Bone className={cn('ml-auto h-4 w-20', !isDesktop && 'shimmer-strong')} />
        <span className="sr-only">Carregando</span>
      </>
    ) : quoteFailed || value === undefined ? (
      '—'
    ) : (
      `${prefix}${formatEth(value)} ETH`
    )

  const ctaClass = isDesktop
    ? 'h-10 w-full rounded-sm font-bold'
    : 'h-14 w-full rounded-full bg-linear-to-b from-primary to-[#B27A47] text-base font-bold'
  const disabled = loading || blockReason !== null
  const cta = disabled ? (
    <Button disabled aria-describedby={blockReason ? reasonId : undefined} className={ctaClass}>
      Conectar e finalizar
    </Button>
  ) : isGuest ? (
    <Link
      to="/login"
      search={{ redirect: '/checkout' }}
      className={cn(buttonVariants(), ctaClass)}
    >
      Conectar e finalizar
    </Link>
  ) : (
    <Link to="/checkout" className={cn(buttonVariants(), ctaClass)}>
      Conectar e finalizar
    </Link>
  )

  return (
    <aside
      aria-labelledby={titleId}
      aria-busy={showBone || quoteUpdating}
      className={cn(
        'flex flex-col gap-4',
        !isDesktop &&
          'sticky bottom-0 z-30 rounded-t-3xl border-t border-border bg-surface px-6 pt-5 pb-[max(1rem,env(safe-area-inset-bottom))]',
      )}
    >
      <h2
        id={titleId}
        className={cn('text-lg font-bold', isDesktop ? 'border-b border-border pb-2' : 'sr-only')}
      >
        Resumo da carteira
      </h2>

      {cart ? <CouponForm cart={cart} quote={quote} /> : <CouponSkeleton strong={!isDesktop} />}

      <dl className={cn('flex flex-col gap-0.5 transition-opacity', quoteUpdating && 'opacity-60')}>
        <Row label="Subtotal">{money(quote?.subtotal)}</Row>
        <Row label="Desconto do lançamento">{money(quote?.discount, '(-) ')}</Row>
        <Row label="Taxa de rede" note="Taxa estimada">
          {money(quote?.networkFee)}
        </Row>
        <Row label="Total" strong>
          {money(quote?.total)}
        </Row>
      </dl>

      {quoteFailed && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">
          Não foi possível cotar o carrinho.
          <Button variant="outline" size="sm" onClick={onRetryQuote}>
            Tentar de novo
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {cta}
        {blockReason && (
          <p id={reasonId} className="text-center text-xs text-muted-foreground">
            {blockReason}
          </p>
        )}
        <Link
          to="/"
          className="rounded-sm py-1 text-center text-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          Continuar explorando
        </Link>
      </div>
    </aside>
  )
}
