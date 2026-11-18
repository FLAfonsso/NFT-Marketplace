import { Link } from '@tanstack/react-router'
import { CircleAlertIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Order } from '@/contracts'
import { useFocusOnMount } from '../useFocusOnMount'

/**
 * Pagamento recusado. Estado terminal: este pedido não é reenviado. "Voltar ao pagamento" abre o
 * checkout, onde uma nova confirmação gera uma nova tentativa; o carrinho segue intacto.
 */
export function RejectedView({ order }: { order: Order }) {
  const titleRef = useFocusOnMount<HTMLHeadingElement>()

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12 md:py-16">
      <section
        aria-labelledby="rejected-title"
        className="flex flex-col items-center gap-4 rounded-lg border border-destructive/50 bg-surface px-6 py-10 text-center max-md:rounded-3xl"
      >
        <CircleAlertIcon aria-hidden="true" className="size-10 text-destructive" />
        <h1 id="rejected-title" ref={titleRef} tabIndex={-1} className="text-xl font-bold outline-none">
          Pagamento recusado
        </h1>
        <p className="text-sm">
          <span className="text-muted-foreground">Motivo: </span>
          {order.rejectionReason ?? 'A rede não aprovou o pagamento.'}
        </p>
        <p className="text-sm text-muted-foreground">
          Nada foi cobrado. Seus itens continuam no carrinho e seus dados foram mantidos.
        </p>
        <Link to="/checkout" className={cn(buttonVariants(), 'mt-2 h-11 rounded-sm px-6 font-bold')}>
          Voltar ao pagamento
        </Link>
      </section>
    </div>
  )
}
