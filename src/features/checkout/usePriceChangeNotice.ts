import Decimal from 'decimal.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CartItem, Quote } from '@/contracts'
import { itemKey } from '@/features/cart'
import { onSyncedEvent } from '@/features/realtime/bus'
import { formatEth } from '@/lib/eth'
import type { CheckoutState } from './machine'

const eth = (value: string) => `${formatEth(value)} ETH`

/** Mudança de preço de um item do pedido, vista na tela do checkout (revisão fechada). */
export interface PriceChangeNotice {
  key: string
  nftId: string
  editionId: string
  /** Preço que o usuário tinha diante de si antes da primeira mudança ainda não confirmada. */
  from: string
  to: string
}

export const priceChangeText = (notice: PriceChangeNotice, name: string) =>
  `O preço de ${name} mudou de ${eth(notice.from)} para ${eth(notice.to)}.`

/**
 * Com o formulário preenchido e nenhum diálogo aberto, `nft.updated` de um item do pedido com
 * preço novo vira um aviso na tela (a cotação é refeita pelo tempo real). O aviso fica até o
 * usuário confirmar a nova cotação: ao abrir a revisão (que já usa a cotação nova) ou em "Entendi".
 * Com a revisão ou o diálogo de mudanças abertos, quem avisa é o useStaleQuoteGuard.
 */
export function usePriceChangeNotice(
  state: CheckoutState,
  items: readonly CartItem[] | undefined,
  quote: Quote | undefined,
) {
  const [notices, setNotices] = useState<PriceChangeNotice[]>([])
  const latest = useRef({ state, items, quote })
  useEffect(() => {
    latest.current = { state, items, quote }
  })

  useEffect(
    () =>
      onSyncedEvent('nft.updated', ({ event, previous }) => {
        const { state: current, items: cartItems, quote: shown } = latest.current
        if (current.status !== 'editing' && current.status !== 'rejected' && current.status !== 'failed') return
        const nftId = event.resource.id
        const affected = cartItems?.filter((i) => i.nftId === nftId) ?? []
        if (affected.length === 0) return

        setNotices((list) => {
          let next = list
          for (const item of affected) {
            const key = itemKey(item)
            const existing = next.find((n) => n.key === key)
            const from =
              existing?.from ??
              shown?.items.find((l) => itemKey(l) === key)?.unitPrice ??
              previous?.price
            if (from === undefined) continue
            const others = next.filter((n) => n.key !== key)
            next = new Decimal(from).eq(event.payload.price)
              ? others
              : [...others, { key, nftId, editionId: item.editionId, from, to: event.payload.price }]
          }
          return next
        })
      }),
    [],
  )

  const dismiss = useCallback(() => setNotices([]), [])

  // Itens que saíram do pedido levam seus avisos junto.
  const keys = new Set(items?.map(itemKey))
  return { notices: notices.filter((n) => keys.has(n.key)), dismiss }
}
