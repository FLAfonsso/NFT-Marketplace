import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { CartItem } from '@/contracts'
import { useAuth } from '@/features/auth'
import { onRealtimeEvent } from '@/features/realtime/socket'
import { queryKeys } from '@/lib/queryKeys'

/**
 * Com o carrinho aberto, `nft.updated` de um NFT do carrinho (preço ou estoque) faz a tela reler
 * o NFT e a cotação na API. O evento só dispara a releitura: os valores vêm sempre do REST, então
 * duplicatas e eventos antigos são inofensivos. Só usuário autenticado tem socket; o visitante
 * vê a mudança na próxima cotação (foco da janela ou alteração do carrinho).
 */
export function useCartRealtime(items: readonly CartItem[] | undefined) {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const userId = auth.status === 'authenticated' ? auth.user.id : null
  const watched = items ? [...new Set(items.map((i) => i.nftId))].join(',') : ''

  useEffect(() => {
    if (!userId || !watched) return
    const ids = new Set(watched.split(','))
    return onRealtimeEvent('nft.updated', (event) => {
      const id = event.resource.id
      if (!ids.has(id)) return
      void queryClient.invalidateQueries({ queryKey: queryKeys.nfts.detail(id) })
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.cart({ userId }), 'quote'] })
    })
  }, [userId, watched, queryClient])
}
