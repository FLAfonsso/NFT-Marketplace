import { useSyncExternalStore } from 'react'
import type { Socket } from 'socket.io-client'
import type { ServerToClientEvents } from '@/contracts'

/**
 * Uma conexão Socket.IO por sessão: autenticada (token) ou de visitante (sem token, só `public`).
 *
 * O socket.io-client é importado sob demanda: o engine.io-client captura o WebSocket global
 * ao ser avaliado, e o MSW só o substitui em enableMocking(). Nenhum módulo do grafo estático
 * de main.tsx pode importá-lo (docs/REALTIME.md).
 */

/**
 * - idle: sem sessão de socket (entre o logout e a conexão de visitante, por exemplo);
 * - connecting: primeira conexão da sessão ainda em andamento;
 * - connected / reconnecting / disconnected: o que o indicador do layout mostra.
 */
export type SocketStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
type EventName = keyof ServerToClientEvents
type AppSocket = Socket<ServerToClientEvents>

interface SocketSession {
  /** null: visitante. */
  token: string | null
  socket: AppSocket | null
  /** Listeners da sessão; são ligados ao socket assim que ele existir. */
  listeners: Map<EventName, Set<(...args: never[]) => void>>
  /** Chamados a cada `connect` que vem depois de uma queda (não na primeira conexão). */
  reconnectHandlers: Set<() => void>
  everConnected: boolean
  closed: boolean
}

let session: SocketSession | null = null

/** Últimos sockets criados nesta aba, só para o diagnóstico. */
const MAX_TRACKED_SOCKETS = 5
const createdSockets: AppSocket[] = []

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

let status: SocketStatus = 'idle'
const statusSubscribers = new Set<() => void>()

const setStatus = (next: SocketStatus) => {
  if (next === status) return
  status = next
  statusSubscribers.forEach((notify) => notify())
}

const subscribeStatus = (notify: () => void) => {
  statusSubscribers.add(notify)
  return () => {
    statusSubscribers.delete(notify)
  }
}

export const getSocketStatus = () => status

export const useSocketStatus = () => useSyncExternalStore(subscribeStatus, getSocketStatus)

// ---------------------------------------------------------------------------
// Ciclo de vida
// ---------------------------------------------------------------------------

/** Abre a conexão da sessão (token null = visitante). Fecha a anterior se o token mudou. */
export function openSocket(token: string | null) {
  if (session && !session.closed && session.token === token) return
  closeSocket()

  const current: SocketSession = {
    token,
    socket: null,
    listeners: new Map(),
    reconnectHandlers: new Set(),
    everConnected: false,
    closed: false,
  }
  session = current
  setStatus('connecting')

  void import('socket.io-client').then(({ io }) => {
    // A sessão pode ter acabado enquanto o módulo carregava.
    if (current.closed) return

    const socket: AppSocket = io({
      transports: ['websocket'],
      // Função: o token é lido de novo a cada reconexão.
      auth: (cb) => cb(current.token ? { token: current.token } : {}),
    })
    current.socket = socket
    createdSockets.push(socket)
    if (createdSockets.length > MAX_TRACKED_SOCKETS) createdSockets.shift()

    const offline = () =>
      setStatus(socket.active ? (current.everConnected ? 'reconnecting' : 'connecting') : 'disconnected')

    socket.on('connect', () => {
      const isReconnect = current.everConnected
      current.everConnected = true
      setStatus('connected')
      if (isReconnect) current.reconnectHandlers.forEach((handler) => handler())
    })
    socket.on('disconnect', offline)
    socket.on('connect_error', offline)
    socket.io.on('reconnect_attempt', () => {
      if (current.everConnected) setStatus('reconnecting')
    })

    for (const [event, handlers] of current.listeners) {
      handlers.forEach((handler) => bind(socket, event, handler))
    }
  })
}

/** Fecha a conexão e remove todos os listeners da sessão. Idempotente. */
export function closeSocket() {
  const current = session
  session = null
  setStatus('idle')
  if (!current) return
  current.closed = true
  current.listeners.clear()
  current.reconnectHandlers.clear()
  if (current.socket) {
    current.socket.removeAllListeners()
    current.socket.io.removeAllListeners()
    current.socket.disconnect()
  }
}

// ---------------------------------------------------------------------------
// Listeners
// ---------------------------------------------------------------------------

const bind = (socket: AppSocket, event: EventName, handler: (...args: never[]) => void) =>
  socket.on(event, handler as ServerToClientEvents[EventName])

const unbind = (socket: AppSocket, event: EventName, handler: (...args: never[]) => void) =>
  socket.off(event, handler as ServerToClientEvents[EventName])

/**
 * Registra um listener na sessão atual e devolve a função de limpeza.
 * Sem sessão, não registra nada. Ao fechar a sessão, os listeners dela são descartados;
 * quem precisa ouvir a próxima sessão registra de novo (ex.: efeito dependente do userId).
 */
export function onRealtimeEvent<E extends EventName>(
  event: E,
  handler: ServerToClientEvents[E],
): () => void {
  const current = session
  if (!current || current.closed) return () => {}

  let handlers = current.listeners.get(event)
  if (!handlers) current.listeners.set(event, (handlers = new Set()))
  handlers.add(handler)
  if (current.socket) bind(current.socket, event, handler)

  return () => {
    current.listeners.get(event)?.delete(handler)
    if (current.socket) unbind(current.socket, event, handler)
  }
}

/** `connect` depois de uma queda, na sessão atual. Devolve a limpeza. */
export function onReconnect(handler: () => void): () => void {
  const current = session
  if (!current || current.closed) return () => {}
  current.reconnectHandlers.add(handler)
  return () => {
    current.reconnectHandlers.delete(handler)
  }
}

/**
 * Diagnóstico (dev): listeners de eventos do servidor no socket atual e nos anteriores desta
 * aba. Sockets de sessões encerradas devem ficar com zero listeners e desconectados.
 */
export function socketDiagnostics() {
  const count = (socket: AppSocket) => ({
    nftUpdated: socket.listeners('nft.updated').length,
    orderUpdated: socket.listeners('order.updated').length,
    total: socket.listeners('nft.updated').length + socket.listeners('order.updated').length,
    connected: socket.connected,
  })
  const current = session?.socket ?? null
  return {
    status,
    guest: session ? session.token === null : null,
    current: current ? count(current) : null,
    previous: createdSockets.filter((s) => s !== current).map(count),
  }
}
