import { useSyncExternalStore } from 'react'
import type { Socket } from 'socket.io-client'
import type { ServerToClientEvents } from '@/contracts'

/**
 * Uma conexão Socket.IO por sessão autenticada.
 *
 * O socket.io-client é importado sob demanda: o engine.io-client captura o WebSocket global
 * ao ser avaliado, e o MSW só o substitui em enableMocking(). Nenhum módulo do grafo estático
 * de main.tsx pode importá-lo (docs/REALTIME.md).
 */

export type SocketStatus = 'connected' | 'reconnecting' | 'disconnected'
type EventName = keyof ServerToClientEvents
type AppSocket = Socket<ServerToClientEvents>

interface SocketSession {
  token: string
  socket: AppSocket | null
  /** Listeners da sessão; são ligados ao socket assim que ele existir. */
  listeners: Map<EventName, Set<(...args: never[]) => void>>
  closed: boolean
}

let session: SocketSession | null = null

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

let status: SocketStatus = 'disconnected'
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

/** Abre a conexão da sessão. Fecha a anterior se o token mudou. */
export function openSocket(token: string) {
  if (session && !session.closed && session.token === token) return
  closeSocket()

  const current: SocketSession = { token, socket: null, listeners: new Map(), closed: false }
  session = current

  void import('socket.io-client').then(({ io }) => {
    // A sessão pode ter acabado enquanto o módulo carregava.
    if (current.closed) return

    const socket: AppSocket = io({
      transports: ['websocket'],
      auth: (cb) => cb({ token: current.token }),
    })
    current.socket = socket

    socket.on('connect', () => setStatus('connected'))
    socket.on('disconnect', () => setStatus(socket.active ? 'reconnecting' : 'disconnected'))
    socket.on('connect_error', () => setStatus(socket.active ? 'reconnecting' : 'disconnected'))
    socket.io.on('reconnect_attempt', () => setStatus('reconnecting'))

    for (const [event, handlers] of current.listeners) {
      handlers.forEach((handler) => bind(socket, event, handler))
    }
  })
}

/** Fecha a conexão e remove todos os listeners da sessão. Idempotente. */
export function closeSocket() {
  const current = session
  session = null
  setStatus('disconnected')
  if (!current) return
  current.closed = true
  current.listeners.clear()
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
