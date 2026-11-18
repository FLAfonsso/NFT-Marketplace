import { http, HttpResponse } from 'msw'
import { ChangePasswordInput, UpdateProfileInput, type Profile, type Wallet } from '@/contracts'
import { hashPassword, verifyPassword } from '../db/auth'
import { read, transact } from '../db/store'
import type { UserRecord } from '../db/types'
import { API, fail, noContent, parseBody, requireUser, route } from './utils'

/** Limite do avatar em data URL, para caber no localStorage da simulação (~512 KB). */
const AVATAR_MAX_LENGTH = 700_000

const toProfile = (user: UserRecord, wallets: readonly Wallet[]): Profile => ({
  id: user.id,
  displayName: user.name,
  username: user.username,
  email: user.email,
  ensName: user.ensName,
  walletNickname: wallets.find((w) => w.role === 'primary')?.nickname ?? null,
  avatarUrl: user.avatarUrl,
  updatedAt: user.updatedAt,
  version: user.version,
})

const usernameTaken = () =>
  fail('conflict', 'Este nome de usuário já está em uso.', {
    username: ['Nome de usuário já em uso'],
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
      return HttpResponse.json(toProfile(user, read().wallets[user.id] ?? []))
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
        if (
          db.users.some(
            (u) => u.id !== user.id && u.username.toLowerCase() === input.username.toLowerCase(),
          )
        ) {
          usernameTaken()
        }
        const record = db.users.find((u) => u.id === user.id)
        if (!record) return fail('not_found', 'Usuário não encontrado.')
        const wallets = db.wallets[user.id] ?? []
        const primary = wallets.find((w) => w.role === 'primary')
        if (input.walletNickname !== null && !primary) {
          fail('conflict', 'Cadastre uma carteira principal antes de definir o apelido.', {
            walletNickname: ['Nenhuma carteira principal cadastrada'],
          })
        }
        if (primary && input.walletNickname !== null && primary.nickname !== input.walletNickname) {
          primary.nickname = input.walletNickname
          primary.updatedAt = tx.now
        }
        record.name = input.displayName
        record.username = input.username
        record.email = input.email
        record.ensName = input.ensName
        if (input.avatarUrl !== undefined) record.avatarUrl = input.avatarUrl
        record.updatedAt = tx.now
        record.version += 1
        return toProfile(record, wallets)
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
