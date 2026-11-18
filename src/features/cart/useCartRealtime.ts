import Decimal from 'decimal.js'
import { useEffect, useRef, useState } from 'react'
import type { CartItem, QuoteWarning } from '@/contracts'
import { onSyncedEvent } from '@/features/realtime/bus'
import { useUpdateQuantity } from './useCartItemMutations'
import { itemKey } from './useCartLines'

/** Mudança de um item do carrinho que chegou em tempo real (texto, não só cor). */
export type CartRealtimeNotice =
  | { type: 'price'; key: string; nftId: string; from: string; to: string }
  | { type: 'stock'; key: string; nftId: string; from: number; to: number }
  | { type: 'adjusted'; key: string; nftId: string; from: number; to: number }

/** Avisos da cotação que um aviso em tempo real já cobre (mesmo item, preço) não aparecem duas vezes. */
export const visibleWarnings = (
  warnings: readonly QuoteWarning[],
  notices: readonly CartRealtimeNotice[],
) =>
  warnings.filter(
    (w) =>
      w.type !== 'price_changed' ||
      !notices.some((n) => n.type === 'price' && n.key === itemKey(w)),
  )

export interface CartRealtimeOptions {
  /**
   * Quantidade acima do novo estoque é ajustada para o máximo disponível (e informada).
   * Só no /cart: no checkout a cotação revisada é marcada como desatualizada e o usuário ajusta.
   */
  adjustQuantities?: boolean
}

/**
 * Avisos do carrinho a partir de `nft.updated` já aceito pelo tempo real (useRealtimeSync aplica
 * o NFT ao cache e invalida a cotação; aqui ficam só os efeitos de tela). O barramento só entrega
 * eventos novos, então duplicata e evento antigo não repetem aviso nem ajuste.
 */
export function useCartRealtime(
  items: readonly CartItem[] | undefined,
  { adjustQuantities = false }: CartRealtimeOptions = {},
) {
  const [notices, setNotices] = useState<CartRealtimeNotice[]>([])
  const update = useUpdateQuantity()
  const latest = useRef({ items, adjustQuantities, mutate: update.mutate })

  useEffect(() => {
    latest.current = { items, adjustQuantities, mutate: update.mutate }
  })

  useEffect(
    () =>
      onSyncedEvent('nft.updated', ({ event, previous }) => {
        const { items: current, adjustQuantities: adjust, mutate } = latest.current
        const nftId = event.resource.id
        const affected = current?.filter((i) => i.nftId === nftId) ?? []
        if (affected.length === 0) return

        const next: CartRealtimeNotice[] = []
        for (const item of affected) {
          const key = itemKey(item)
          if (previous && !new Decimal(previous.price).eq(event.payload.price)) {
            next.push({ type: 'price', key, nftId, from: previous.price, to: event.payload.price })
          }
          const available = event.payload.editions.find((e) => e.id === item.editionId)?.available
          if (available === undefined) continue
          const before = previous?.editions.find((e) => e.id === item.editionId)?.available ?? null
          if (before !== null && available < before) {
            next.push({ type: 'stock', key, nftId, from: before, to: available })
          }
          if (adjust && available > 0 && available < item.quantity) {
            mutate({ nftId, editionId: item.editionId, quantity: available })
            next.push({ type: 'adjusted', key, nftId, from: item.quantity, to: available })
          }
        }
        if (next.length === 0) return
        // Um aviso por item e tipo: o mais recente substitui o anterior.
        setNotices((list) => [
          ...list.filter((n) => !next.some((m) => m.key === n.key && m.type === n.type)),
          ...next,
        ])
      }),
    [],
  )

  // Itens que saíram do carrinho levam seus avisos junto.
  const keys = new Set(items?.map(itemKey))
  return notices.filter((n) => keys.has(n.key))
}
