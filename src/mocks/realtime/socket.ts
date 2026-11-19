import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws, type WebSocketHandlerConnection } from 'msw'
import { REALTIME_EVENTS, type RealtimeEvent } from '@/contracts'
import { checkToken } from '../db/auth'
import { subscribe } from '../db/store'
import { assertContract, clearHistory, remember, toRealtimeEvent } from './events'

/**
 * Servidor Socket.IO simulado (Engine.IO v4, transporte websocket), no caminho padrão
 * /socket.io da própria origem. Documentação: docs/REALTIME.md.
 *
 * - Handshake: o OPEN do Engine.IO sai daqui; o CONNECT do cliente traz `auth.token`, que é
 *   validado antes de aceitar. Token inválido ou vencido: CONNECT_ERROR. Sem token: visitante.
 * - Salas: toda conexão aceita entra em "public"; com sessão, também em "user:<id>".
 *   nft.updated vai para "public"; order.updated só para a sala do dono.
 * - Eventos: vêm do emissor de mudanças do store, com a version que o REST também devolve.
 *   A codificação dos pacotes de evento é feita pelo @mswjs/socket.io-binding.
 */

const PING_INTERVAL_MS = 25_000
/** Folgado: abas em segundo plano atrasam timers, e o cliente derruba a conexão sem ping. */
const PING_TIMEOUT_MS = 60_000
const MAX_PAYLOAD = 1_000_000
/** Tempo para o cliente ler o CONNECT_ERROR/DISCONNECT antes de o servidor fechar o socket. */
const CLOSE_GRACE_MS = 1_000
/** Código de fechamento usado nas quedas simuladas (faixa livre de aplicação). */
const OUTAGE_CLOSE_CODE = 4000

const PUBLIC_ROOM = 'public'
const userRoom = (userId: string) => `user:${userId}`

type Client = WebSocketHandlerConnection['client']
type Server = WebSocketHandlerConnection['server']

interface Connection {
  /** sid do Engine.IO (transporte). */
  id: string
  /** sid do Socket.IO (namespace "/"); o cliente o expõe em socket.id. */
  socketId: string
  client: Client
  io: ReturnType<typeof toSocketIo>
  state: 'handshaking' | 'connected' | 'closing' | 'closed'
  userId: string | null
  token: string | null
  heartbeat: ReturnType<typeof setInterval>
}

let seq = 0
const connections = new Set<Connection>()
const rooms = new Map<string, Set<Connection>>()
/** true entre disconnectSockets() e reconnectSockets(): novas conexões são recusadas. */
let outage = false

/**
 * Contadores de handshake desde o último reset (diagnóstico para testes, via socketStats):
 * - accepted: CONNECT aceito (com sessão ou visitante);
 * - rejected: CONNECT_ERROR por sessão inválida ou vencida;
 * - refused: tentativa recusada durante uma queda simulada (disconnectSockets).
 * Servem para provar que o cliente não repete tentativas sem fim.
 */
const stats = { accepted: 0, rejected: 0, refused: 0 }

// ---------------------------------------------------------------------------
// Salas
// ---------------------------------------------------------------------------

const join = (conn: Connection, room: string) => {
  let members = rooms.get(room)
  if (!members) rooms.set(room, (members = new Set()))
  members.add(conn)
}

const leaveAll = (conn: Connection) => {
  for (const [room, members] of rooms) {
    members.delete(conn)
    if (members.size === 0) rooms.delete(room)
  }
}

// ---------------------------------------------------------------------------
// Protocolo (pacotes brutos do Engine.IO / Socket.IO que o binding não trata)
// ---------------------------------------------------------------------------

/** Pacote MESSAGE do Engine.IO ("4") com um pacote Socket.IO do namespace dado. */
const socketIoPacket = (type: '0' | '1' | '4', nsp: string, data?: unknown) =>
  `4${type}${nsp === '/' ? '' : `${nsp},`}${data === undefined ? '' : JSON.stringify(data)}`

/** Lê um pacote CONNECT ("40", "40{...}", "40/nsp,{...}"). null se não for CONNECT. */
const parseConnect = (raw: string): { nsp: string; auth: unknown } | null => {
  if (!raw.startsWith('40')) return null
  let rest = raw.slice(2)
  let nsp = '/'
  if (rest.startsWith('/')) {
    const comma = rest.indexOf(',')
    nsp = comma < 0 ? rest : rest.slice(0, comma)
    rest = comma < 0 ? '' : rest.slice(comma + 1)
  }
  if (rest === '') return { nsp, auth: undefined }
  try {
    return { nsp, auth: JSON.parse(rest) as unknown }
  } catch {
    return { nsp, auth: null }
  }
}

/** Só conexões do socket.io-client; o resto (ex.: HMR do Vite) segue para o servidor real. */
const isSocketIoUrl = (url: URL) =>
  url.pathname.startsWith('/socket.io/') &&
  url.searchParams.get('EIO') === '4' &&
  url.searchParams.get('transport') === 'websocket'

/**
 * O binding responde sozinho ao handshake (OPEN e CONNECT aceito) quando não existe conexão
 * com o servidor real, e aceitaria qualquer cliente antes de ver o `auth`. Ele pula essa
 * resposta quando `server.socket` existe, deixando o handshake "por conta do servidor".
 * Este proxy assume esse papel; o resto do handle segue intacto.
 */
const serverOwningHandshake = (server: Server): Server =>
  new Proxy(server, {
    get(target, prop) {
      if (prop === 'socket') return { readyState: WebSocket.OPEN }
      const value: unknown = Reflect.get(target, prop, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })

// ---------------------------------------------------------------------------
// Ciclo de vida da conexão
// ---------------------------------------------------------------------------

const closeConnection = (conn: Connection, code?: number, reason?: string) => {
  if (conn.state === 'closed') return
  conn.state = 'closed'
  clearInterval(conn.heartbeat)
  leaveAll(conn)
  connections.delete(conn)
  try {
    conn.client.close(code, reason)
  } catch {
    // Já fechado pelo cliente.
  }
}

/** Fecha depois de um intervalo, para o último pacote chegar ao cliente. */
const closeSoon = (conn: Connection) => {
  setTimeout(() => closeConnection(conn), CLOSE_GRACE_MS)
}

const reject = (conn: Connection, nsp: string, message: string, reason: string) => {
  stats.rejected += 1
  conn.state = 'closing'
  conn.client.send(socketIoPacket('4', nsp, { message, data: { code: 'unauthorized', reason } }))
  closeSoon(conn)
}

/** Desconexão iniciada pelo servidor: o cliente recebe "io server disconnect" e não reconecta sozinho. */
const kick = (conn: Connection) => {
  if (conn.state !== 'connected') return
  conn.state = 'closing'
  leaveAll(conn)
  conn.client.send(socketIoPacket('1', '/'))
  closeSoon(conn)
}

const onConnect = (conn: Connection, nsp: string, auth: unknown) => {
  if (conn.state !== 'handshaking') return
  if (nsp !== '/') {
    // Mesma resposta do servidor real para namespace inexistente.
    conn.client.send(socketIoPacket('4', nsp, { message: 'Invalid namespace' }))
    return
  }
  const token =
    typeof auth === 'object' && auth !== null ? (auth as Record<string, unknown>).token : undefined

  if (token === undefined || token === null || token === '') {
    conn.userId = null
    conn.token = null
  } else {
    const check = typeof token === 'string' ? checkToken(token) : ({ status: 'invalid' } as const)
    if (check.status === 'expired') return reject(conn, nsp, 'Sessão expirada.', 'expired')
    if (check.status !== 'ok') return reject(conn, nsp, 'Sessão inválida.', 'invalid')
    conn.userId = check.user.id
    conn.token = check.session.token
    join(conn, userRoom(check.user.id))
  }
  join(conn, PUBLIC_ROOM)
  stats.accepted += 1
  conn.state = 'connected'
  conn.client.send(socketIoPacket('0', '/', { sid: conn.socketId }))
}

const onRawMessage = (conn: Connection, data: unknown) => {
  if (typeof data !== 'string' || conn.state === 'closed') return
  const connect = parseConnect(data)
  if (connect) return onConnect(conn, connect.nsp, connect.auth)
  // DISCONNECT do namespace "/" (socket.disconnect() no cliente).
  if (data === '41') {
    conn.state = 'closing'
    leaveAll(conn)
  }
  // PONG ("3") e eventos do cliente ("42...") não têm efeito: o app só escuta.
}

const accept = (connection: WebSocketHandlerConnection) => {
  const n = ++seq
  const { client } = connection
  const conn: Connection = {
    id: `eio_${n}`,
    socketId: `sio_${n}`,
    client,
    io: toSocketIo({
      client,
      server: serverOwningHandshake(connection.server),
      info: connection.info,
      params: connection.params,
    }),
    state: 'handshaking',
    userId: null,
    token: null,
    heartbeat: setInterval(() => {
      if (conn.state === 'connected' && conn.token && checkToken(conn.token).status !== 'ok') {
        return kick(conn)
      }
      client.send('2')
    }, PING_INTERVAL_MS),
  }
  connections.add(conn)

  client.addEventListener('message', (event) => onRawMessage(conn, event.data))
  client.addEventListener('close', () => closeConnection(conn))

  // Engine.IO OPEN. Enviado antes do "open" do socket, fica na fila até ele abrir.
  client.send(
    `0${JSON.stringify({
      sid: conn.id,
      upgrades: [],
      pingInterval: PING_INTERVAL_MS,
      pingTimeout: PING_TIMEOUT_MS,
      maxPayload: MAX_PAYLOAD,
    })}`,
  )
}

// ---------------------------------------------------------------------------
// Handler MSW
// ---------------------------------------------------------------------------

/**
 * O MSW remove o prefixo /socket.io/ da URL do cliente antes de casar o handler, então o link
 * é a própria origem; o filtro de URL fica em isSocketIoUrl.
 */
const socketIoLink = ws.link(window.location.origin.replace(/^http/, 'ws'))

export const realtimeHandler = socketIoLink.addEventListener('connection', (connection) => {
  if (!isSocketIoUrl(connection.client.url)) {
    connection.server.connect()
    return
  }
  if (outage) return refuse(connection.client)
  accept(connection)
})

/**
 * Recusa como um servidor fora do ar: o navegador dispara "error" e depois "close" 1006.
 * Só o "error" faz o socket.io-client agendar a próxima tentativa (com backoff); um "close"
 * limpo antes do "open" só seria percebido no timeout de conexão (20 s).
 */
function refuse(client: Client) {
  stats.refused += 1
  const socket: unknown = Reflect.get(client, 'socket')
  if (socket instanceof EventTarget) socket.dispatchEvent(new Event('error'))
  client.close(1006, 'Queda simulada')
}

// ---------------------------------------------------------------------------
// Publicação
// ---------------------------------------------------------------------------

/** A conexão ainda pode receber eventos? Sessão revogada ou vencida é desconectada. */
const authorized = (conn: Connection) => {
  if (conn.state !== 'connected') return false
  if (conn.token && checkToken(conn.token).status !== 'ok') {
    kick(conn)
    return false
  }
  return true
}

const audienceOf = (event: RealtimeEvent) =>
  event.type === REALTIME_EVENTS.orderUpdated
    ? [...(rooms.get(userRoom(event.userId)) ?? [])].filter((c) => c.userId === event.userId)
    : [...(rooms.get(PUBLIC_ROOM) ?? [])]

/** Entrega um evento à sua audiência, sem registrar no histórico. Devolve quantos receberam. */
export const deliver = (event: RealtimeEvent) => {
  const checked = assertContract(event)
  if (!checked) return 0
  let delivered = 0
  for (const conn of audienceOf(checked)) {
    if (!authorized(conn)) continue
    conn.io.client.emit(checked.type, checked)
    delivered++
  }
  return delivered
}

/** Registra no histórico e entrega. */
export const publish = (event: RealtimeEvent) => {
  remember(event)
  return deliver(event)
}

subscribe((change) => {
  publish(toRealtimeEvent(change))
})

// ---------------------------------------------------------------------------
// Controle (window.__mocks, via src/mocks/realtime/control.ts)
// ---------------------------------------------------------------------------

/** Derruba todas as conexões e recusa novas até reconnectSockets(). */
export const disconnectSockets = () => {
  outage = true
  const count = connections.size
  for (const conn of [...connections]) closeConnection(conn, OUTAGE_CLOSE_CODE, 'Queda simulada')
  return count
}

/** Volta a aceitar conexões. O cliente reconecta na próxima tentativa do seu backoff. */
export const reconnectSockets = () => {
  outage = false
}

/** Conexões abertas, para inspeção. */
export const listSockets = () =>
  [...connections].map(({ id, socketId, state, userId }) => ({ id, socketId, state, userId }))

/** Handshakes aceitos, recusados por sessão e recusados por queda, desde o último reset. */
export const socketStats = () => ({ ...stats })

/** Chamado por reset() dos cenários: fecha as conexões, sai da queda e esquece o histórico. */
export const resetRealtime = () => {
  outage = false
  clearHistory()
  Object.assign(stats, { accepted: 0, rejected: 0, refused: 0 })
  for (const conn of [...connections]) closeConnection(conn, 1012, 'Reset da simulação')
}
