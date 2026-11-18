import { http, HttpResponse } from 'msw'
import { LoginInput, RegisterInput, type Session } from '@/contracts'
import {
  bearerToken,
  createSession,
  hashPassword,
  revokeSession,
  toSession,
  verifyPassword,
} from '../db/auth'
import { ensureCart, mergeGuestCart, nextId, read, transact, userCartKey } from '../db/store'
import { API, fail, guestIdFrom, noContent, parseBody, requireUser, route } from './utils'

const emailTaken = () =>
  fail('conflict', 'Já existe uma conta com este e-mail.', {
    email: ['E-mail já cadastrado'],
  })

/** Hash fixo para gastar o mesmo tempo quando o e-mail não existe. */
const DUMMY_USER = {
  passwordSalt: '00000000000000000000000000000000',
  passwordHash: '0'.repeat(64),
}

export const authHandlers = [
  http.post(
    `${API}/auth/register`,
    route(async ({ request }) => {
      const guestId = guestIdFrom(request)
      const input = await parseBody(request, RegisterInput)
      if (read().users.some((u) => u.email === input.email)) emailTaken()
      const credentials = await hashPassword(input.password)

      const session = transact((db, tx): Session => {
        // Revalida dentro da transação: o hash é assíncrono.
        if (db.users.some((u) => u.email === input.email)) emailTaken()
        const user = {
          id: nextId(db, 'usr'),
          name: input.name,
          email: input.email,
          bio: '',
          avatarUrl: null,
          ...credentials,
          createdAt: tx.now,
          updatedAt: tx.now,
          version: 1,
        }
        db.users.push(user)
        db.favorites[user.id] = []
        db.wallets[user.id] = []
        ensureCart(db, userCartKey(user.id), tx.now)
        if (guestId) mergeGuestCart(db, guestId, user.id, tx.now)
        return toSession(user, createSession(db, user.id, tx.now))
      })
      return HttpResponse.json(session, { status: 201 })
    }),
  ),

  http.post(
    `${API}/auth/login`,
    route(async ({ request }) => {
      const guestId = guestIdFrom(request)
      const input = await parseBody(request, LoginInput)
      const user = read().users.find((u) => u.email === input.email)
      const valid = await verifyPassword(input.password, user ?? DUMMY_USER)
      if (!user || !valid) return fail('unauthorized', 'E-mail ou senha incorretos.')

      const session = transact((db, tx): Session => {
        ensureCart(db, userCartKey(user.id), tx.now)
        if (guestId) mergeGuestCart(db, guestId, user.id, tx.now)
        return toSession(user, createSession(db, user.id, tx.now))
      })
      return HttpResponse.json(session)
    }),
  ),

  http.get(
    `${API}/auth/session`,
    route(({ request }) => {
      const { user, session } = requireUser(request)
      return HttpResponse.json(toSession(user, session))
    }),
  ),

  http.post(
    `${API}/auth/logout`,
    route(({ request }) => {
      // Idempotente: sem token ou com token já encerrado também responde 204.
      const token = bearerToken(request)
      if (token) revokeSession(token)
      return noContent()
    }),
  ),
]
