import { useNavigate } from '@tanstack/react-router'
import Decimal from 'decimal.js'
import { ChevronDownIcon } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useWatch } from 'react-hook-form'
import { Breadcrumb } from '@/components/Breadcrumb'
import { MobileHeader } from '@/components/layout/MobileHeader'
import { Button } from '@/components/ui/button'
import { WalletType, type ApiError, type Wallet } from '@/contracts'
import { useAuth } from '@/features/auth'
import { itemKey, useCart, useCartLines, useQuote } from '@/features/cart'
import { formatEth } from '@/lib/eth'
import { isApiRequestError } from '@/lib/api'
import { useIsDesktop } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import { isBusy } from '../machine'
import { fieldForApiPath, toCollectorFields } from '../schema'
import { attemptStorage } from '../storage'
import { useCheckoutData } from '../useCheckoutData'
import { useCheckoutFlow } from '../useCheckoutFlow'
import { useCheckoutForm } from '../useCheckoutForm'
import { priceChangeText, usePriceChangeNotice } from '../usePriceChangeNotice'
import { useStaleQuoteGuard } from '../useStaleQuoteGuard'
import { useWalletConnection } from '../useWalletConnection'
import { ChangesDialog } from './ChangesDialog'
import { CollectorForm } from './CollectorForm'
import { OrderSummary } from './OrderSummary'
import { ReviewDialog } from './ReviewDialog'
import { WalletSection } from './WalletSection'

/** Pagamento (/checkout, privada). A rota garante a sessão; a chave remonta tudo ao trocar de usuário. */
export function CheckoutPage() {
  const auth = useAuth()
  if (auth.status !== 'authenticated') return null
  return <CheckoutScreen key={auth.user.id} userId={auth.user.id} />
}

const errorMessage = (error: unknown) =>
  isApiRequestError(error) ? error.message : 'Ocorreu um erro inesperado.'

function CheckoutScreen({ userId }: { userId: string }) {
  const isDesktop = useIsDesktop()
  const navigate = useNavigate()
  const formSectionId = useId()
  const reasonId = useId()

  const cartQuery = useCart()
  const cart = cartQuery.data
  const lines = useCartLines(cart?.items ?? [])
  const quote = useQuote(cart)
  const { profile, wallets } = useCheckoutData(userId)
  const walletList = wallets.data?.items
  const { form, ready, selectWallet, applyFieldErrors } = useCheckoutForm(
    userId,
    profile.data,
    walletList,
  )
  const { errors, isValid } = form.formState
  const [formOpen, setFormOpen] = useState(false)

  const nameOf = (line: { nftId: string; editionId: string }) =>
    lines.find((l) => l.key === itemKey(line))?.nft?.name ?? 'Item do pedido'

  /** Erros de campo da API: abre a seção (mobile) e leva o foco ao primeiro campo. */
  const onFieldErrors = (fieldErrors: NonNullable<ApiError['fieldErrors']>) => {
    const placed = applyFieldErrors(fieldErrors)
    if (placed) {
      setFormOpen(true)
      const first = Object.keys(fieldErrors).map(fieldForApiPath).find(Boolean)
      if (first) requestAnimationFrame(() => form.setFocus(first))
    }
    return placed
  }

  const flow = useCheckoutFlow({ userId, nameOf, onFieldErrors })
  const { state } = flow
  const busy = isBusy(state)
  useStaleQuoteGuard(state, nameOf, flow.markReviewStale)

  const walletId = useWatch({ control: form.control, name: 'walletId' })
  const walletTypeValue = useWatch({ control: form.control, name: 'walletType' })
  const provider = WalletType.safeParse(walletTypeValue).data ?? null
  const connection = useWalletConnection(walletId, provider)

  // Carrinho vazio: volta para o carrinho (exceto com um envio em andamento ou sem resposta).
  const emptyCart = !!cart && cart.items.length === 0
  useEffect(() => {
    if (emptyCart && state.status === 'editing' && !attemptStorage.load(userId)?.uncertain) {
      void navigate({ to: '/cart', replace: true })
    }
  }, [emptyCart, state.status, navigate, userId])

  const quoteData = quote.data
  const quoteLoading = quote.isPending && quote.fetchStatus !== 'idle'
  const priceNotices = usePriceChangeNotice(state, cart?.items, quoteData)
  // Releitura também bloqueia: a cotação foi invalidada (ex.: preço mudou em tempo real) e a
  // revisão não pode abrir com o valor anterior. Vale também enquanto a cotação exibida ainda
  // não reflete o preço do aviso.
  const quoteBehind = priceNotices.notices.some((n) =>
    quoteData?.items.some((l) => itemKey(l) === n.key && !new Decimal(l.unitPrice).eq(n.to)),
  )
  const quoteUpdating = quote.isPlaceholderData || quote.isRefetching || quoteBehind
  const couponRejected =
    !!cart?.couponCode && !!quoteData?.coupon && quoteData.coupon.status !== 'applied'

  const blockReason: string | null = !ready
    ? 'Carregando seus dados…'
    : quote.isError
      ? 'Não foi possível cotar o pedido.'
      : quoteLoading || quoteUpdating || !quoteData
        ? 'Atualizando a cotação…'
        : quoteData.warnings.some((w) => w.type === 'unavailable')
          ? 'Um item está indisponível na quantidade pedida. Ajuste o carrinho.'
          : couponRejected
            ? 'Remova o cupom recusado para continuar.'
            : !isValid
              ? 'Preencha corretamente os dados do colecionador.'
              : !connection.connection
                ? 'Conecte a carteira para confirmar a compra.'
                : null
  const canConfirm = blockReason === null && !busy

  /** Mostra os erros do formulário (abre a seção no mobile e foca o primeiro campo). */
  const revealErrors = () => {
    setFormOpen(true)
    requestAnimationFrame(() => void form.handleSubmit(() => undefined)())
  }

  const confirm = () => {
    if (!canConfirm) return
    void form.handleSubmit(
      (values) => {
        const selected = walletList?.find((w) => w.id === values.walletId)
        if (!selected || !connection.connection || !quoteData || !cart) return
        // A revisão abre com a cotação nova: é a confirmação do aviso de mudança de preço.
        priceNotices.dismiss()
        flow.openReview({
          quote: quoteData,
          items: cart.items,
          couponCode: cart.couponCode,
          wallet: selected,
          provider: connection.connection.provider,
          network: values.network,
          form: toCollectorFields(values),
        })
      },
      () => setFormOpen(true),
    )()
  }

  const dataError = profile.error ?? wallets.error
  const loadAlert = (cartQuery.isError && !cart) || (dataError && !ready)

  const pageError =
    state.status === 'editing' && state.error ? state.error.message : null
  const rejected = state.status === 'rejected' ? state.order : null

  const alerts = (
    <>
      {loadAlert && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-sm border border-destructive/40 bg-surface p-4 text-sm text-destructive">
          <p className="flex-1">
            Não foi possível carregar {cartQuery.isError ? 'o carrinho' : 'seu perfil e suas carteiras'}.{' '}
            {errorMessage(cartQuery.error ?? dataError)}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (cartQuery.isError) void cartQuery.refetch()
              if (profile.isError) void profile.refetch()
              if (wallets.isError) void wallets.refetch()
            }}
          >
            Tentar de novo
          </Button>
        </div>
      )}
      {pageError && (
        <p role="alert" className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {pageError}
        </p>
      )}
      {rejected && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-sm border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <p className="flex-1">
            Pagamento recusado{rejected.rejectionReason ? `: ${rejected.rejectionReason}` : '.'} Seus itens
            continuam no carrinho e seus dados foram mantidos.
          </p>
          <Button type="button" variant="outline" size="sm" disabled={!canConfirm} onClick={confirm}>
            Tentar de novo
          </Button>
        </div>
      )}
    </>
  )

  // A região fica sempre no DOM (leitores de tela só anunciam mudanças em regiões já existentes).
  const priceNotice = (
    <div
      role="status"
      data-testid="price-change-notice"
      className="flex flex-col gap-2 empty:hidden"
    >
      {priceNotices.notices.length > 0 && (
        <div className="flex flex-col gap-2 rounded-sm border border-primary/40 bg-surface p-4 text-sm">
          {priceNotices.notices.map((n) => (
            <p key={n.key} className="font-bold">
              {priceChangeText(n, nameOf(n))}
            </p>
          ))}
          <p>
            {quoteData && !quoteUpdating ? (
              <>
                Novo total: <strong className="text-primary">{formatEth(quoteData.total)} ETH</strong>.{' '}
                Confirme a compra para revisar com a cotação nova.
              </>
            ) : (
              'Atualizando a cotação…'
            )}
          </p>
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={priceNotices.dismiss}>
            Entendi
          </Button>
        </div>
      )}
    </div>
  )

  const summary = (
    <OrderSummary
      cart={cart}
      quote={quoteData}
      lines={lines}
      loading={!cart || quoteLoading}
      updating={quoteUpdating}
      failed={quote.isError}
      onRetry={() => void quote.refetch()}
      locked={busy}
    />
  )

  const walletSection = (
    <WalletSection
      wallets={walletList}
      loading={wallets.isPending}
      loadError={wallets.isError && !walletList ? errorMessage(wallets.error) : null}
      onRetryLoad={() => void wallets.refetch()}
      selectedId={walletId}
      onSelect={(w: Wallet) => selectWallet(w)}
      provider={provider}
      onProvider={(p) =>
        form.setValue('walletType', p, { shouldDirty: true, shouldValidate: true, shouldTouch: true })
      }
      connection={connection.state}
      onConnect={() => void connection.connect()}
      onDisconnect={connection.disconnect}
      disabled={busy || !ready}
    />
  )

  const confirmBlock = (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        disabled={!canConfirm}
        aria-describedby={blockReason ? reasonId : undefined}
        onClick={confirm}
        className={cn(
          'w-full font-bold',
          isDesktop
            ? 'h-11 rounded-sm'
            : 'h-14 rounded-full bg-linear-to-b from-primary to-[#B27A47] text-base',
        )}
      >
        {busy ? 'Enviando pedido…' : 'Confirmar compra'}
      </Button>
      {blockReason && (
        <p id={reasonId} className="text-center text-xs text-muted-foreground">
          {blockReason}
          {ready && !isValid && (
            <>
              {' '}
              <button
                type="button"
                onClick={revealErrors}
                className="rounded-sm text-primary underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Revisar dados
              </button>
            </>
          )}
        </p>
      )}
    </div>
  )

  const collector = (
    <CollectorForm form={form} disabled={busy || !ready} />
  )

  const errorCount = Object.keys(errors).length
  const displayName = form.getValues('displayName')
  const email = form.getValues('email')

  const dialogs = (
    <>
      <ReviewDialog
        state={state}
        nameOf={nameOf}
        onCancel={flow.cancel}
        onSend={flow.send}
        onRetry={flow.retry}
      />
      <ChangesDialog state={state} onCancel={flow.cancel} onAccept={flow.acceptChanges} />
    </>
  )

  if (isDesktop) {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-4 pt-6 pb-16">
        <Breadcrumb
          className="mb-8"
          items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/' }, { label: 'Pagamento' }]}
        />
        <h1 className="sr-only">Pagamento</h1>
        <div className="mb-6 flex flex-col gap-3 empty:hidden">{alerts}</div>
        <div className="flex flex-col gap-12 lg:grid lg:grid-cols-[minmax(0,1fr)_405px] lg:items-start lg:gap-8">
          <form
            noValidate
            aria-labelledby={formSectionId}
            onSubmit={(event) => {
              event.preventDefault()
              confirm()
            }}
            className="flex flex-col gap-4"
          >
            <h2 id={formSectionId} className="text-lg font-bold">
              Perfil do colecionador
            </h2>
            {collector}
          </form>
          <aside aria-label="Resumo e pagamento" className="flex flex-col gap-6">
            {priceNotice}
            {summary}
            {walletSection}
            {confirmBlock}
          </aside>
        </div>
        {dialogs}
      </div>
    )
  }

  const total = quoteData ? `${formatEth(quoteData.total)} ETH` : '—'

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col">
      <MobileHeader title="Pagamento com carteira" fallback="/cart" />
      <div className="flex flex-1 flex-col gap-6 px-4 pb-6">
        {alerts}
        {priceNotice}
        <section className="rounded-3xl bg-surface">
          <h2>
            <button
              type="button"
              aria-expanded={formOpen}
              aria-controls={`${formSectionId}-panel`}
              onClick={() => setFormOpen((v) => !v)}
              className="flex w-full items-center gap-3 rounded-3xl px-5 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-bold">Dados do colecionador</span>
                <span className={cn('truncate text-sm', errorCount > 0 || (ready && !isValid) ? 'text-destructive' : 'text-muted-foreground')}>
                  {!ready
                    ? 'Carregando…'
                    : errorCount > 0
                      ? `${errorCount} ${errorCount === 1 ? 'campo precisa' : 'campos precisam'} de atenção`
                      : !isValid
                        ? 'Complete os campos obrigatórios'
                        : `${displayName} · ${email}`}
                </span>
              </span>
              <ChevronDownIcon
                aria-hidden="true"
                className={cn('size-5 shrink-0 transition-transform motion-reduce:transition-none', formOpen && 'rotate-180')}
              />
            </button>
          </h2>
          <form
            id={`${formSectionId}-panel`}
            hidden={!formOpen}
            noValidate
            aria-label="Dados do colecionador"
            onSubmit={(event) => {
              event.preventDefault()
              confirm()
            }}
            className="px-5 pb-5"
          >
            {collector}
          </form>
        </section>
        {walletSection}
        {summary}
      </div>
      <div className="sticky bottom-0 z-30 flex flex-col gap-3 bg-background/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        <p className="flex items-baseline justify-end gap-6 text-lg font-bold">
          Total:
          <span className="text-primary">{total}</span>
        </p>
        {confirmBlock}
      </div>
      {dialogs}
    </div>
  )
}
