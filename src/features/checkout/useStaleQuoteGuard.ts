import Decimal from 'decimal.js'
import { useEffect, useRef } from 'react'
import { onSyncedEvent } from '@/features/realtime/bus'
import { formatEth } from '@/lib/eth'
import type { CheckoutState } from './machine'
import type { QuoteChange } from './quoteChanges'

const eth = (value: string) => `${formatEth(value)} ETH`
const units = (n: number) => (n === 0 ? 'Esgotado' : `${n} ${n === 1 ? 'disponível' : 'disponíveis'}`)

export const STALE_REASON = 'O preço ou a disponibilidade de um item mudou durante a revisão.'

/**
 * O checkout nunca confirma com cotação velha: com a revisão aberta (ou o diálogo de mudanças),
 * `nft.updated` aceito de um item do pedido com preço ou estoque diferente marca a cotação
 * revisada como desatualizada (as diferenças vêm do evento; a cotação nova, da API).
 */
export function useStaleQuoteGuard(
  state: CheckoutState,
  nameOf: (line: { nftId: string; editionId: string }) => string,
  markReviewStale: (changes: QuoteChange[], reason: string) => void,
) {
  const latest = useRef({ state, nameOf, markReviewStale })
  useEffect(() => {
    latest.current = { state, nameOf, markReviewStale }
  })

  useEffect(
    () =>
      onSyncedEvent('nft.updated', ({ event, previous }) => {
        const { state: current, nameOf: name, markReviewStale: mark } = latest.current
        if (current.status !== 'reviewing' && current.status !== 'changed') return
        const nftId = event.resource.id
        // Compara com o que o usuário tem diante de si: a cotação nova (se já veio) ou a revisada.
        const reference = (current.status === 'changed' && current.quote) || current.review.quote

        const changes: QuoteChange[] = []
        for (const line of reference.items) {
          if (line.nftId !== nftId) continue
          const key = `${line.nftId}:${line.editionId}`
          if (!new Decimal(line.unitPrice).eq(event.payload.price)) {
            changes.push({
              id: `${key}:price`,
              label: `${name(line)}: preço unitário`,
              before: eth(line.unitPrice),
              after: eth(event.payload.price),
            })
          }
          const available = event.payload.editions.find((e) => e.id === line.editionId)?.available
          const before = previous?.editions.find((e) => e.id === line.editionId)?.available
          if (available !== undefined && available !== before) {
            changes.push({
              id: `${key}:stock`,
              label: `${name(line)}: disponibilidade`,
              before: before === undefined ? 'Disponível' : units(before),
              after: available < line.quantity && available > 0
                ? `Só ${available} para ${line.quantity} pedido(s)`
                : units(available),
            })
          }
        }
        if (changes.length > 0) mark(changes, STALE_REASON)
      }),
    [],
  )
}
