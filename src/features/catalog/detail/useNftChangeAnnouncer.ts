import Decimal from 'decimal.js'
import { useEffect, useRef, useState } from 'react'
import type { Nft } from '@/contracts'
import { onSyncedEvent } from '@/features/realtime/bus'
import { formatEth } from '@/lib/eth'

const eth = (value: string) => `${formatEth(value)} ETH`

interface Selection {
  editionId: string | null
  quantity: number
}

/**
 * Texto para a região aria-live="polite" do detalhe quando o NFT aberto muda em tempo real:
 * preço, estoque da edição escolhida e ajustes da seleção (o limite e a edição se ajustam
 * sozinhos em usePurchase, a partir do cache já atualizado). Só eventos aceitos chegam aqui,
 * então duplicata e evento antigo não repetem o anúncio.
 */
export function useNftChangeAnnouncer(nft: Nft, selection: Selection) {
  const [message, setMessage] = useState('')
  const latest = useRef({ name: nft.name, selection })

  useEffect(() => {
    latest.current = { name: nft.name, selection }
  })

  useEffect(
    () =>
      onSyncedEvent('nft.updated', ({ event, previous }) => {
        if (event.resource.id !== nft.id || !previous) return
        const { name, selection: { editionId, quantity } } = latest.current
        const parts: string[] = []

        if (!new Decimal(previous.price).eq(event.payload.price)) {
          parts.push(`O preço de ${name} mudou de ${eth(previous.price)} para ${eth(event.payload.price)}.`)
        }

        const edition = previous.editions.find((e) => e.id === editionId)
        const available = event.payload.editions.find((e) => e.id === editionId)?.available
        if (edition && available !== undefined && available !== edition.available) {
          if (available === 0) {
            // usePurchase passa para a primeira edição com estoque (mesma regra aqui).
            const fallback = previous.editions.find(
              (e) => (event.payload.editions.find((p) => p.id === e.id)?.available ?? 0) > 0,
            )
            parts.push(
              fallback
                ? `A edição ${edition.name} esgotou. A seleção passou para a edição ${fallback.name}.`
                : `A edição ${edition.name} esgotou.`,
            )
          } else {
            parts.push(`A edição ${edition.name} agora tem ${available} ${available === 1 ? 'unidade disponível' : 'unidades disponíveis'}.`)
            const max = Math.min(available, edition.maxPerOrder)
            if (quantity > max) parts.push(`A quantidade selecionada foi ajustada para ${max}.`)
          }
        }

        if (parts.length > 0) setMessage(parts.join(' '))
      }),
    [nft.id],
  )

  return message
}
