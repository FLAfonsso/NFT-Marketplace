import type { Nft, NftUpdatedEvent, Order, OrderUpdatedEvent } from '@/contracts'

/**
 * Eventos já aceitos por useRealtimeSync (validados, do usuário da sessão, sem duplicata nem
 * version antiga) e já aplicados ao cache. As telas assinam aqui, nunca o socket direto: assim
 * um efeito de tela (aviso, anúncio, diálogo) roda no máximo uma vez por mudança.
 */
export interface SyncedEvents {
  'nft.updated': {
    event: NftUpdatedEvent
    /** NFT em cache antes do evento (detalhe ou lista), se havia. */
    previous: Nft | undefined
  }
  'order.updated': {
    event: OrderUpdatedEvent
    /** Pedido em cache antes do evento, se havia. */
    previous: Order | undefined
  }
}

type SyncedName = keyof SyncedEvents
type Handler<E extends SyncedName> = (payload: SyncedEvents[E]) => void

const handlers: { [E in SyncedName]: Set<Handler<E>> } = {
  'nft.updated': new Set(),
  'order.updated': new Set(),
}

/** Assina um evento aceito. Devolve a limpeza (use no retorno do efeito). */
export function onSyncedEvent<E extends SyncedName>(name: E, handler: Handler<E>): () => void {
  const set = handlers[name] as Set<Handler<E>>
  set.add(handler)
  return () => {
    set.delete(handler)
  }
}

export function publishSynced<E extends SyncedName>(name: E, payload: SyncedEvents[E]) {
  for (const handler of [...(handlers[name] as Set<Handler<E>>)]) {
    try {
      handler(payload)
    } catch (error) {
      console.error('[realtime] falha ao tratar', name, error)
    }
  }
}

export const syncedListenerCount = () => ({
  'nft.updated': handlers['nft.updated'].size,
  'order.updated': handlers['order.updated'].size,
})
