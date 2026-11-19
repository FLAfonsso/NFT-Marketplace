import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Cart, Quote } from '@/contracts'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { Bone } from './CartItemRow'
import { useCoupon } from '../useCoupon'

const labelClass = 'text-sm font-bold'

/** Placeholder com as dimensões do campo de cupom. */
export function CouponSkeleton({ strong }: { strong?: boolean }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2">
      <Bone className={cn('hidden h-5 w-36 md:block', strong && 'skeleton-bone-strong')} />
      <Bone className={cn('h-12 w-full rounded-full md:h-10 md:rounded-sm', strong && 'skeleton-bone-strong')} />
    </div>
  )
}

/**
 * Cupom do carrinho. Sem cupom: campo e "Aplicar" (recusa aparece no campo, com aria-invalid e
 * mensagem associada). Com cupom: mostra o desconto da cotação e "Remover cupom".
 */
export function CouponForm({ cart, quote }: { cart: Cart; quote: Quote | undefined }) {
  const { apply, remove } = useCoupon(cart)
  const [code, setCode] = useState('')
  const inputId = useId()
  const messageId = useId()

  const saved = cart.couponCode
  const coupon = quote?.coupon

  if (saved) {
    // Cupom guardado que a cotação não aceita mais (ex.: venceu com a tela aberta).
    const rejected =
      coupon && coupon.status !== 'applied'
        ? (coupon.message ?? (coupon.status === 'expired' ? 'Cupom expirado.' : 'Cupom inválido.'))
        : null
    return (
      <div className="flex flex-col gap-2">
        <p className={`${labelClass} hidden md:block`}>Código promocional</p>
        <div className="flex min-h-12 items-center justify-between gap-3 rounded-3xl border border-border px-4 py-2 md:min-h-10 md:rounded-sm">
          {rejected ? (
            <p role="alert" className="text-sm text-destructive">
              {saved}: {rejected}
            </p>
          ) : (
            <p role="status" className="text-sm">
              Cupom <strong className="text-primary">{saved}</strong> aplicado
              {quote && (
                <span className="block text-xs text-muted-foreground">
                  Desconto de {formatEth(quote.discount)} ETH
                </span>
              )}
            </p>
          )}
          <Button
            variant="link"
            className="h-auto shrink-0 p-0"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            {remove.isPending ? 'Removendo…' : 'Remover cupom'}
          </Button>
        </div>
        {remove.error && (
          <p role="alert" className="text-xs text-destructive">
            {remove.error.message}
          </p>
        )}
      </div>
    )
  }

  const error = apply.error?.message
  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (apply.isPending) return
    apply.mutate(code, { onSuccess: () => setCode('') })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
      <label htmlFor={inputId} className={`${labelClass} sr-only md:not-sr-only`}>
        Código promocional
      </label>
      <div className="flex items-center rounded-full border border-border bg-background/40 p-1 focus-within:ring-2 focus-within:ring-ring has-[[aria-invalid=true]]:border-destructive md:rounded-sm md:p-0">
        <Input
          id={inputId}
          value={code}
          onChange={(event) => {
            setCode(event.target.value)
            if (apply.isError) apply.reset()
          }}
          placeholder="Digite o código..."
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? messageId : undefined}
          className="h-10 flex-1 rounded-none border-0 bg-transparent px-3 text-base placeholder:text-placeholder focus-visible:ring-0 aria-invalid:ring-0 md:text-sm dark:bg-transparent"
        />
        <Button
          type="submit"
          disabled={apply.isPending}
          className="h-10 rounded-full bg-linear-to-b from-primary to-[#B27A47] px-5 font-bold md:rounded-sm md:bg-none md:bg-primary"
        >
          {apply.isPending ? 'Aplicando…' : 'Aplicar'}
        </Button>
      </div>
      {error && (
        <p id={messageId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}
