import { http, HttpResponse } from 'msw'
import { ChangePasswordInput, UpdateProfileInput, type Profile } from '@/contracts'
import { hashPassword, verifyPassword } from '../db/auth'
import { read, transact } from '../db/store'
import type { UserRecord } from '../db/types'
import { API, fail, noContent, parseBody, requireUser, route } from './utils'

/** Limite do avatar em data URL, para caber no localStorage da simulação (~512 KB). */
const AVATAR_MAX_LENGTH = 700_000

const toProfile = (user: UserRecord): Profile => ({
  id: user.id,
  name: user.name,
  email: user.email,
  bio: user.bio,
  avatarUrl: user.avatarUrl,
  updatedAt: user.updatedAt,
  version: user.version,
})

const emailTaken = () =>
  fail('conflict', 'Este e-mail já está em uso por outra conta.', {
    email: ['E-mail já cadastrado'],
  })

export const profileHandlers = [
  http.get(
    `${API}/profile`,
    route(({ request }) => {
      const { user } = requireUser(request)
      return HttpResponse.json(toProfile(user))
    }),
  ),

  /** Atualiza dados e avatar. `avatarUrl` ausente mantém o atual; null remove. */
  http.put(
    `${API}/profile`,
    route(async ({ request }) => {
      const { user } = requireUser(request)
      const input = await parseBody(request, UpdateProfileInput)
      if (input.avatarUrl && input.avatarUrl.length > AVATAR_MAX_LENGTH) {
        fail('validation', 'A imagem do avatar é grande demais.', {
          avatarUrl: ['Envie uma imagem de até 500 KB'],
        })
      }
      const profile = transact((db, tx) => {
        if (db.users.some((u) => u.id !== user.id && u.email === input.email)) emailTaken()
        const record = db.users.find((u) => u.id === user.id)
        if (!record) return fail('not_found', 'Usuário não encontrado.')
        record.name = input.name
        record.email = input.email
        record.bio = input.bio
        if (input.avatarUrl !== undefined) record.avatarUrl = input.avatarUrl
        record.updatedAt = tx.now
        record.version += 1
        return toProfile(record)
      })
      return HttpResponse.json(profile)
    }),
  ),

  /** Troca a senha e encerra as outras sessões do usuário (a atual continua válida). */
  http.put(
    `${API}/profile/password`,
    route(async ({ request }) => {
      const { user, session } = requireUser(request)
      const input = await parseBody(request, ChangePasswordInput)
      const current = read().users.find((u) => u.id === user.id)
      if (!current || !(await verifyPassword(input.currentPassword, current))) {
        fail('validation', 'Senha atual incorreta.', { currentPassword: ['Senha atual incorreta'] })
      }
      const credentials = await hashPassword(input.newPassword)
      transact((db, tx) => {
        const record = db.users.find((u) => u.id === user.id)
        if (!record) return
        Object.assign(record, credentials, { updatedAt: tx.now, version: record.version + 1 })
        for (const [token, s] of Object.entries(db.sessions)) {
          if (s.userId === user.id && token !== session.token) delete db.sessions[token]
        }
      })
      return noContent()
    }),
  ),
]
