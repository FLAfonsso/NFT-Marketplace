import { RealtimeEvent } from '@/contracts'
import type { StoreEvent } from '../db/store'

/**
 * Tradução dos eventos internos do store (src/mocks/db/store.ts) para os eventos do contrato
 * (src/contracts/events.ts), e histórico do que foi publicado (para emitDuplicate e emitStale).
 */

/**
 * Identidade estável do evento: recurso, versão e instante da mudança.
 * Um reenvio do mesmo evento tem o mesmo id. O instante entra para o id não se repetir
 * depois de reset(), quando as versões voltam às do seed.
 */
const eventId = (resource: string, resourceId: string, version: number, occurredAt: string) =>
  `evt:${resource}:${resourceId}:v${version}:${Date.parse(occurredAt)}`

export const toRealtimeEvent = (change: StoreEvent): RealtimeEvent => {
  if (change.type === 'nft.updated') {
    const { nft } = change
    return {
      id: eventId('nft', nft.id, nft.version, change.occurredAt),
      type: 'nft.updated',
      version: nft.version,
      occurredAt: change.occurredAt,
      resource: { type: 'nft', id: nft.id },
      payload: {
        price: nft.price,
        editions: nft.editions.map(({ id, available }) => ({ id, available })),
      },
    }
  }
  const { order } = change
  return {
    id: eventId('order', order.id, order.version, change.occurredAt),
    type: 'order.updated',
    version: order.version,
    occurredAt: change.occurredAt,
    resource: { type: 'order', id: order.id },
    userId: change.userId,
    payload: {
      status: order.status,
      transactionRef: order.transactionRef,
      rejectionReason: order.rejectionReason,
    },
  }
}

/** Confere o evento contra o contrato antes de sair. Um evento inválido é um bug do mock. */
export const assertContract = (event: RealtimeEvent): RealtimeEvent | null => {
  const result = RealtimeEvent.safeParse(event)
  if (result.success) return result.data
  console.error('[mocks] evento de tempo real fora do contrato, não enviado', event, result.error)
  return null
}

// ---------------------------------------------------------------------------
// Histórico
// ---------------------------------------------------------------------------

const HISTORY_LIMIT = 200
const history: RealtimeEvent[] = []

export const remember = (event: RealtimeEvent) => {
  history.push(event)
  if (history.length > HISTORY_LIMIT) history.splice(0, history.length - HISTORY_LIMIT)
}

export const clearHistory = () => {
  history.length = 0
}

export const lastEvent = () => history.at(-1)

/** Último evento publicado para um recurso. */
export const lastEventFor = (resource: RealtimeEvent['resource']) =>
  history.findLast((e) => e.resource.type === resource.type && e.resource.id === resource.id)

/**
 * Evento com versão anterior à atual, para o recurso do último evento publicado:
 * - se o histórico tem um evento mais antigo do mesmo recurso, devolve ele exatamente (id,
 *   versão e payload antigos), como um atraso de rede entregaria;
 * - senão, sintetiza um com versão atual − 1, payload atual e id próprio (sufixo ":stale").
 * null quando não há evento publicado ou a versão já é 0.
 */
export const staleEvent = (): RealtimeEvent | null => {
  const latest = lastEvent()
  if (!latest) return null
  const older = history.findLast(
    (e) =>
      e.resource.type === latest.resource.type &&
      e.resource.id === latest.resource.id &&
      e.version < latest.version,
  )
  if (older) return older
  if (latest.version === 0) return null
  return { ...latest, id: `${latest.id}:stale`, version: latest.version - 1 }
}
