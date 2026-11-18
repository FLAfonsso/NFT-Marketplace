import { useRef } from 'react'
import { Breadcrumb } from '@/components/Breadcrumb'
import { MobileHeader } from '@/components/layout/MobileHeader'
import { NftCarousel } from '@/components/NftCarousel'
import { useAuth } from '@/features/auth'
import { useIsDesktop } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import { useCart } from '../useCart'
import { itemKey, useCartLines } from '../useCartLines'
import { useQuote } from '../useQuote'
import { useSuggestions } from '../useSuggestions'
import { CartItemRow, CartRowSkeleton, DESKTOP_COLUMNS } from './CartItemRow'
import { CartSummary } from './CartSummary'
import { CartEmpty, CartError } from './CartStates'
import { useCartRealtime, visibleWarnings } from '../useCartRealtime'
import { QuoteNotices } from './QuoteNotices'
import { useFocusAfterRemove } from './useFocusAfterRemove'

const SKELETON_ROWS = 3

function ColumnHeaders() {
  return (
    <div
      aria-hidden="true"
      className={cn('grid gap-4 border-b border-border px-2.5 pb-2 text-sm font-bold', DESKTOP_COLUMNS)}
    >
      <span>NFTs</span>
      <span>Preço</span>
      <span>Edições</span>
      <span>Total</span>
      <span />
    </div>
  )
}

/** Carrinho (/cart): itens da API, cotação como referência dos valores e sugestões. */
export function CartPage() {
  const isDesktop = useIsDesktop()
  const auth = useAuth()
  const cartQuery = useCart()
  const cart = cartQuery.data
  const items = cart?.items

  const realtimeNotices = useCartRealtime(items, { adjustQuantities: true })
  const lines = useCartLines(items ?? [])
  const quote = useQuote(cart)
  const suggestions = useSuggestions(items?.map((i) => i.nftId) ?? [])

  const listRef = useRef<HTMLUListElement>(null)
  const emptyHeadingRef = useRef<HTMLHeadingElement>(null)
  const focus = useFocusAfterRemove(
    lines.map((l) => l.key),
    listRef,
    emptyHeadingRef,
  )

  const quoteData = quote.data
  const quoteFailed = quote.isError
  const quoteLoading = quote.isPending && quote.fetchStatus !== 'idle'
  // Placeholder (itens ou cupom mudaram) ou releitura (cotação invalidada pelo tempo real).
  const quoteUpdating = quote.isPlaceholderData || quote.isRefetching
  const warnings = quoteData?.warnings ?? []

  // Cotação com problema bloqueia o checkout: a tela nunca finaliza com valor que a API não confirmou.
  const couponRejected =
    !!cart?.couponCode && !!quoteData?.coupon && quoteData.coupon.status !== 'applied'
  const blockReason: string | null = !cart
    ? null
    : quoteFailed
      ? 'Não foi possível cotar o carrinho.'
      : quoteLoading || quoteUpdating
        ? 'Atualizando a cotação…'
        : warnings.some((w) => w.type === 'unavailable')
          ? 'Ajuste ou remova os itens indisponíveis para continuar.'
          : couponRejected
            ? 'Remova o cupom recusado para continuar.'
            : null

  const shownWarnings = visibleWarnings(warnings, realtimeNotices)
  const warningsFor = (key: string) => shownWarnings.filter((w) => itemKey(w) === key)
  const noticesFor = (key: string) => realtimeNotices.filter((n) => n.key === key)
  const quoteLines = new Map(quoteData?.items.map((l) => [itemKey(l), l]))

  const isLoading = cartQuery.isPending
  const loadFailed = !cart && cartQuery.isError
  const isEmpty = !!cart && cart.items.length === 0

  const header = isDesktop ? (
    <>
      <Breadcrumb
        className="mb-4"
        items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/' }, { label: 'Carrinho' }]}
      />
      <h1 className="sr-only">Carrinho de NFTs</h1>
    </>
  ) : (
    <MobileHeader title="Carrinho de NFTs" />
  )

  let body
  if (loadFailed) {
    body = (
      <div className="px-4 md:px-0">
        <CartError
          error={cartQuery.error}
          retrying={cartQuery.isFetching}
          onRetry={() => void cartQuery.refetch()}
        />
      </div>
    )
  } else if (isEmpty) {
    body = (
      <div className="px-4 md:px-0">
        <CartEmpty headingRef={emptyHeadingRef} />
      </div>
    )
  } else {
    body = (
      <div className="flex min-h-[calc(100dvh-4.5rem)] flex-col md:min-h-0 lg:grid lg:grid-cols-[minmax(0,1fr)_332px] lg:items-start lg:gap-12">
        <div className="flex flex-1 flex-col px-4 md:px-0">
          <QuoteNotices warnings={warnings} notices={realtimeNotices} lines={lines} />
          {isDesktop && <ColumnHeaders />}
          <ul
            ref={listRef}
            aria-label="Itens do carrinho"
            aria-busy={isLoading}
            className="mt-3 flex flex-col gap-3 pb-4 md:mt-3 md:gap-2 md:pb-8"
          >
            {isLoading
              ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
                  <CartRowSkeleton key={i} isDesktop={isDesktop} />
                ))
              : lines.map((line) => (
                  <CartItemRow
                    key={line.key}
                    line={line}
                    quoteLine={quoteLines.get(line.key)}
                    quoteState={quoteFailed ? 'error' : 'ready'}
                    warnings={warningsFor(line.key)}
                    realtime={noticesFor(line.key)}
                    isDesktop={isDesktop}
                    onRemove={focus.prepare}
                    onRemoveFailed={focus.cancel}
                  />
                ))}
          </ul>
        </div>
        <div className="md:mt-0">
          <CartSummary
            cart={cart}
            quote={quoteData}
            quoteLoading={quoteLoading}
            quoteUpdating={quoteUpdating}
            quoteFailed={quoteFailed}
            onRetryQuote={() => void quote.refetch()}
            blockReason={blockReason}
            isGuest={auth.status !== 'authenticated'}
            isDesktop={isDesktop}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] md:px-4 md:pt-6 md:pb-16">
      <div className="md:px-0">{header}</div>
      {body}
      {!loadFailed && (
        <div className="mt-8 px-4 pb-6 md:mt-16 md:px-0 md:pb-0">
          <NftCarousel
            title="Colecionadores também viram"
            listLabel="NFTs sugeridos"
            items={suggestions.data}
            isPending={suggestions.isPending}
            isError={suggestions.isError}
            onRetry={() => void suggestions.refetch()}
          />
        </div>
      )}
    </div>
  )
}
