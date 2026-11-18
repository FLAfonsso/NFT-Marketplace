import Decimal from 'decimal.js'
import { TriangleAlertIcon } from 'lucide-react'
import type { QuoteWarning } from '@/contracts'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { itemKey, type CartLine } from '../useCartLines'

const describe = (warning: QuoteWarning, name: string) => {
  if (warning.type === 'price_changed') {
    const rose = new Decimal(warning.currentPrice).gt(warning.previousPrice)
    return `${name}: o preço ${rose ? 'subiu' : 'caiu'} de ${formatEth(warning.previousPrice)} ETH para ${formatEth(warning.currentPrice)} ETH. O resumo já usa o novo valor.`
  }
  const stock =
    warning.available === 0
      ? 'está esgotado'
      : `tem só ${warning.available} ${warning.available === 1 ? 'unidade disponível' : 'unidades disponíveis'}`
  return `${name} ${stock} e o carrinho pede ${warning.requested}. Ajuste a quantidade ou remova o item.`
}

/**
 * Avisos da cotação (preço alterado, item indisponível) no topo da tela. A região role="status"
 * fica sempre montada, para o leitor de tela anunciar avisos que chegam depois.
 */
export function QuoteNotices({
  warnings,
  lines,
}: {
  warnings: readonly QuoteWarning[]
  lines: readonly CartLine[]
}) {
  const names = new Map(lines.map((l) => [l.key, l.nft?.name]))
  return (
    <div role="status" className={cn(warnings.length > 0 && 'mb-4')}>
      {warnings.length > 0 && (
        <div className="flex gap-3 rounded-sm border border-primary/50 bg-surface px-4 py-3 text-sm">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="font-bold text-primary">Seu carrinho mudou</p>
            <ul className="flex flex-col gap-1 text-muted-foreground">
              {warnings.map((w) => (
                <li key={`${w.type}:${itemKey(w)}`}>
                  {describe(w, names.get(itemKey(w)) ?? 'Um item')}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
