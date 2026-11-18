import type { Session, User } from '@/contracts'
import { mockSettings } from '../settings'
import { read, transact } from './store'
import type { DbState, SessionRecord, UserRecord } from './types'

/**
 * Autenticação simulada.
 * - Senhas: PBKDF2-SHA256 (Web Crypto) com salt aleatório; o texto claro nunca é guardado.
 * - Tokens: 32 bytes aleatórios em base64url, opacos, com expiração.
 */

const PBKDF2_ITERATIONS = 100_000
const encoder = new TextEncoder()

const toHex = (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')

const fromHex = (hex: string) =>
  new Uint8Array(hex.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) ?? [])

const derive = async (password: string, saltHex: string) => {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations: PBKDF2_ITERATIONS },
    key,
    256,
  )
  return toHex(bits)
}

export const hashPassword = async (password: string) => {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)))
  return { passwordSalt: salt, passwordHash: await derive(password, salt) }
}

/** Comparação em tempo constante do hash derivado. */
export const verifyPassword = async (
  password: string,
  user: Pick<UserRecord, 'passwordHash' | 'passwordSalt'>,
) => {
  const candidate = await derive(password, user.passwordSalt)
  if (candidate.length !== user.passwordHash.length) return false
  let diff = 0
  for (let i = 0; i < candidate.length; i++) {
    diff |= candidate.charCodeAt(i) ^ user.passwordHash.charCodeAt(i)
  }
  return diff === 0
}

const newToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export const toUser = (user: UserRecord): User => ({
  id: user.id,
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl,
})

export const toSession = (user: UserRecord, session: SessionRecord): Session => ({
  user: toUser(user),
  token: session.token,
  expiresAt: session.expiresAt,
})

/** Cria uma sessão dentro de uma transação já aberta. */
export const createSession = (db: DbState, userId: string, now: string): SessionRecord => {
  // Limpa sessões vencidas para o estado não crescer indefinidamente.
  for (const [token, s] of Object.entries(db.sessions)) {
    if (Date.parse(s.expiresAt) <= Date.parse(now)) delete db.sessions[token]
  }
  const session: SessionRecord = {
    token: newToken(),
    userId,
    createdAt: now,
    expiresAt: new Date(Date.parse(now) + mockSettings.sessionTtlMs).toISOString(),
  }
  db.sessions[session.token] = session
  return session
}

export type SessionCheck =
  | { status: 'ok'; user: UserRecord; session: SessionRecord }
  | { status: 'missing' }
  | { status: 'invalid' }
  | { status: 'expired' }

export const bearerToken = (request: Request) => {
  const header = request.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(\S+)$/i.exec(header)
  return match?.[1] ?? null
}

/**
 * Resolve um token de sessão sem alterar o estado. Usado pelo REST (via checkSession)
 * e pelo handshake e pela entrega de eventos do Socket.IO (src/mocks/realtime).
 */
export const checkToken = (token: string | null | undefined): SessionCheck => {
  if (!token) return { status: 'missing' }
  const session = read().sessions[token]
  if (!session) return { status: 'invalid' }
  if (Date.parse(session.expiresAt) <= Date.now()) return { status: 'expired' }
  const user = read().users.find((u) => u.id === session.userId)
  if (!user) return { status: 'invalid' }
  return { status: 'ok', user, session }
}

/** Resolve a sessão do cabeçalho Authorization. Sessões vencidas são removidas. */
export const checkSession = (request: Request): SessionCheck => {
  const token = bearerToken(request)
  const check = checkToken(token)
  if (check.status === 'expired' && token) {
    transact((db) => {
      delete db.sessions[token]
    })
  }
  return check
}

/** Encerra uma sessão (idempotente). */
export const revokeSession = (token: string) =>
  transact((db) => {
    delete db.sessions[token]
  })

/** Força a expiração das sessões (de um usuário ou de todos), para cenários de teste. */
export const expireSessions = (userId?: string) =>
  transact((db, tx) => {
    for (const s of Object.values(db.sessions)) {
      if (!userId || s.userId === userId) s.expiresAt = tx.now
    }
  })
