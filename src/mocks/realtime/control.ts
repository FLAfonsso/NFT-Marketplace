import type { Socket } from 'socket.io-client'
import {
  EthString,
  RealtimeEvent,
  type ServerToClientEvents,
} from '@/contracts'
import { read, settleOrder, updateNft, type SettlementOutcome } from '../db/store'
import { lastEvent, lastEventFor, staleEvent } from './events'
import { deliver, disconnectSockets, listSockets, reconnectSockets, socketStats } from './socket'

/**
 * Controles de tempo real do painel window.__mocks (src/mocks/control.ts).
 * Toda mudança passa pelo store, então REST e evento ficam com o mesmo estado e a mesma version.
 */

export interface NftUpdateInput {
  nftId: string
  /** Novo preço em ETH (string decimal). */
  price?: string
  /**
   * Novo estoque: um número vale para todas as edições; um objeto define por edição
   * ({ [editionId]: disponível }). Limitado a [0, supply].
   */
  availability?: number | Record<string, number>
}

const toCount = (value: number, label: string) => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} deve ser um inteiro não negativo (recebido ${String(value)}).`)
  }
  return value
}

/** Altera preço e/ou disponibilidade de um NFT no store e emite nft.updated. Devolve o evento. */
export const emitNftUpdate = ({ nftId, price, availability }: NftUpdateInput) => {
  const nft = read().nfts.find((n) => n.id === nftId)
  if (!nft) throw new Error(`NFT não encontrado: "${nftId}".`)
  if (price === undefined && availability === undefined) {
    throw new Error('Informe price e/ou availability.')
  }
  if (price !== undefined && !EthString.safeParse(price).success) {
    throw new Error(`price deve ser uma string decimal em ETH (recebido ${JSON.stringify(price)}).`)
  }
  const stock: Record<string, number> = {}
  if (typeof availability === 'number') {
    for (const edition of nft.editions) stock[edition.id] = toCount(availability, 'availability')
  } else if (availability) {
    for (const [editionId, value] of Object.entries(availability)) {
      if (!nft.editions.some((e) => e.id === editionId)) {
        throw new Error(`Edição "${editionId}" não existe em ${nftId}.`)
      }
      stock[editionId] = toCount(value, `availability.${editionId}`)
    }
  }

  updateNft(nftId, (draft) => {
    if (price !== undefined) draft.price = price
    for (const edition of draft.editions) {
      const value = stock[edition.id]
      if (value !== undefined) edition.available = Math.min(edition.supply, value)
    }
  })
  return lastEventFor({ type: 'nft', id: nftId })
}

/**
 * Liquida um pedido pendente com o status pedido (mesmos efeitos da liquidação automática:
 * estoque devolvido na recusa, carrinho baixado na confirmação) e emite order.updated.
 * Pedidos confirmados ou recusados são terminais.
 */
export const emitOrderUpdate = ({ orderId, status }: { orderId: string; status: SettlementOutcome }) => {
  if (status !== 'confirmed' && status !== 'rejected') {
    throw new Error('status deve ser "confirmed" ou "rejected" (um pedido só sai de "pending").')
  }
  const record = read().orders.find((r) => r.order.id === orderId)
  if (!record) throw new Error(`Pedido não encontrado: "${orderId}".`)
  if (record.order.status !== 'pending') {
    throw new Error(`O pedido ${orderId} já está "${record.order.status}", que é terminal.`)
  }
  settleOrder(orderId, status)
  return lastEventFor({ type: 'order', id: orderId })
}

/** Reenvia o último evento publicado, idêntico (mesmo id e version). */
export const emitDuplicate = () => {
  const event = lastEvent()
  if (!event) {
    console.warn('[mocks] nenhum evento publicado ainda.')
    return null
  }
  deliver(event)
  return event
}

/** Envia um evento com version anterior à atual do recurso do último evento (ver staleEvent). */
export const emitStale = () => {
  const event = staleEvent()
  if (!event) {
    console.warn('[mocks] não há evento com version anterior para enviar.')
    return null
  }
  deliver(event)
  return event
}

/** Token da sessão válida mais recente do store (para o probe). */
const latestToken = () =>
  Object.values(read().sessions)
    .filter((s) => Date.parse(s.expiresAt) > Date.now())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.token ?? null

/**
 * Abre uma conexão real com socket.io-client e loga no console o que chega.
 * Ferramenta de verificação manual; o app não usa. `token` ausente: sessão mais recente;
 * null: visitante. Devolve (na hora) a função que fecha a conexão.
 *
 * O socket.io-client é importado sob demanda de propósito: o engine.io-client guarda
 * globalThis.WebSocket ao carregar o módulo, então ele só pode ser avaliado depois de o MSW
 * substituir o WebSocket (worker.start). Um import estático aqui carregaria o módulo cedo
 * demais, para o probe e para o app, que compartilha a mesma instância.
 */
export const probe = ({ token }: { token?: string | null } = {}) => {
  const authToken = token === undefined ? latestToken() : token
  const who = authToken ? (read().sessions[authToken]?.userId ?? 'token desconhecido') : 'visitante'
  const tag = `[probe ${who}]`
  let socket: Socket<ServerToClientEvents> | null = null
  let closed = false
  const onReconnectAttempt = (attempt: number) => console.info(tag, 'tentativa de reconexão', attempt)

  void import('socket.io-client').then(({ io }) => {
    if (closed) return
    const s: Socket<ServerToClientEvents> = io({
      transports: ['websocket'],
      auth: authToken ? { token: authToken } : {},
    })
    s.on('connect', () => console.info(tag, 'conectado', s.id))
    s.on('connect_error', (error) => console.warn(tag, 'connect_error', error.message, error))
    s.on('disconnect', (reason) => console.info(tag, 'desconectado:', reason))
    s.io.on('reconnect_attempt', onReconnectAttempt)
    s.onAny((name: string, payload: unknown) => {
      const parsed = RealtimeEvent.safeParse(payload)
      if (parsed.success) console.info(tag, name, parsed.data)
      else console.warn(tag, name, 'fora do contrato', payload, parsed.error)
    })
    socket = s
  })

  return () => {
    closed = true
    if (!socket) return
    socket.io.off('reconnect_attempt', onReconnectAttempt)
    socket.offAny()
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }
}

export const realtimeControl = {
  emitNftUpdate,
  emitOrderUpdate,
  emitDuplicate,
  emitStale,
  /** Derruba as conexões e recusa novas até reconnectSockets(). Devolve quantas caíram. */
  disconnectSockets,
  /** Volta a aceitar conexões; o cliente reconecta na próxima tentativa do backoff. */
  reconnectSockets,
  /** Conexões abertas: { id, socketId, state, userId }. */
  listSockets,
  /** Contadores de handshake { accepted, rejected, refused } desde o último reset. */
  socketStats,
  probe,
}
