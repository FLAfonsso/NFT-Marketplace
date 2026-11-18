import Decimal from 'decimal.js'
import { TriangleAlertIcon } from 'lucide-react'
import type { QuoteWarning } from '@/contracts'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { visibleWarnings, type CartRealtimeNotice } from '../useCartRealtime'
import { itemKey, type CartLine } from '../useCartLines'

const eth = (value: string) => `${formatEth(value)} ETH`

const describeWarning = (warning: QuoteWarning, name: string) => {
  if (warning.type === 'price_changed') {
    const rose = new Decimal(warning.currentPrice).gt(warning.previousPrice)
    return `${name}: o preço ${rose ? 'subiu' : 'caiu'} de ${eth(warning.previousPrice)} para ${eth(warning.currentPrice)}. O resumo já usa o novo valor.`
  }
  const stock =
    warning.available === 0
      ? 'está esgotado'
      : `tem só ${warning.available} ${warning.available === 1 ? 'unidade disponível' : 'unidades disponíveis'}`
  return `${name} ${stock} e o carrinho pede ${warning.requested}. Ajuste a quantidade ou remova o item.`
}

const describeNotice = (notice: CartRealtimeNotice, name: string) => {
  switch (notice.type) {
    case 'price': {
      const rose = new Decimal(notice.to).gt(notice.from)
      return `${name}: o preço ${rose ? 'subiu' : 'caiu'} de ${eth(notice.from)} para ${eth(notice.to)}. O resumo já usa o novo valor.`
    }
    case 'stock':
      return `${name}: disponibilidade reduzida de ${notice.from} para ${notice.to} ${notice.to === 1 ? 'unidade' : 'unidades'}.`
    case 'adjusted':
      return `${name}: a quantidade foi ajustada de ${notice.from} para ${notice.to}, o máximo disponível agora.`
  }
}

/**
 * Avisos do carrinho no topo da tela: mudanças recebidas em tempo real (preço, disponibilidade,
 * quantidade ajustada) e avisos da cotação (preço alterado, item indisponível). A região
 * role="status" fica sempre montada, para o leitor de tela anunciar avisos que chegam depois.
 */
export function QuoteNotices({
  warnings,
  notices = [],
  lines,
}: {
  warnings: readonly QuoteWarning[]
  notices?: readonly CartRealtimeNotice[]
  lines: readonly CartLine[]
}) {
  const names = new Map(lines.map((l) => [l.key, l.nft?.name]))
  const shownWarnings = visibleWarnings(warnings, notices)
  const messages = [
    ...notices.map((n) => ({ id: `rt:${n.type}:${n.key}`, text: describeNotice(n, names.get(n.key) ?? 'Um item') })),
    ...shownWarnings.map((w) => ({
      id: `${w.type}:${itemKey(w)}`,
      text: describeWarning(w, names.get(itemKey(w)) ?? 'Um item'),
    })),
  ]
  return (
    <div role="status" className={cn(messages.length > 0 && 'mb-4')}>
      {messages.length > 0 && (
        <div className="flex gap-3 rounded-sm border border-primary/50 bg-surface px-4 py-3 text-sm">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="font-bold text-primary">Seu carrinho mudou</p>
            <ul className="flex flex-col gap-1 text-muted-foreground">
              {messages.map((m) => (
                <li key={m.id}>{m.text}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
