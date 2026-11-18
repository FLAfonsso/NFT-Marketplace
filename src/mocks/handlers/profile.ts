import { http, HttpResponse, type HttpResponseResolver } from 'msw'
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

const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const AVATAR_MAX_BYTES = 2 * 1024 * 1024

async function toDataUrl(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return `data:${file.type};base64,${btoa(binary)}`
}

const setAvatar = (userId: string, avatarUrl: string | null) =>
  transact((db, tx) => {
    const record = db.users.find((u) => u.id === userId)
    if (!record) return fail('not_found', 'Usuário não encontrado.')
    record.avatarUrl = avatarUrl
    record.updatedAt = tx.now
    record.version += 1
    return toProfile(record, db.wallets[userId] ?? [])
  })

const usernameTaken = () =>
  fail('conflict', 'Este nome de usuário já está em uso.', {
    username: ['Nome de usuário já em uso'],
  })

const emailTaken = () =>
  fail('conflict', 'Este e-mail já está em uso por outra conta.', {
    email: ['E-mail já cadastrado'],
  })

/** PATCH é o método do contrato; PUT segue aceito como alias. */
const both = (path: string, resolver: HttpResponseResolver) => [
  http.patch(path, resolver),
  http.put(path, resolver),
]

export const profileHandlers = [
  http.get(
    `${API}/profile`,
    route(({ request }) => {
      const { user } = requireUser(request)
      return HttpResponse.json(toProfile(user, read().wallets[user.id] ?? []))
    }),
  ),

  /** Atualiza dados e avatar. `avatarUrl` ausente mantém o atual; null remove. */
  ...both(
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
  ...both(
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

  /** Avatar: multipart com o campo `file` (png, jpeg ou webp, até 2 MB). Responde o Profile. */
  http.put(
    `${API}/profile/avatar`,
    route(async ({ request }) => {
      const { user } = requireUser(request)
      let file: FormDataEntryValue | null = null
      try {
        file = (await request.formData()).get('file')
      } catch {
        // Corpo que não é multipart cai na validação abaixo.
      }
      if (!(file instanceof File)) {
        return fail('validation', 'Envie a imagem no campo "file".', {
          avatar: ['Selecione uma imagem'],
        })
      }
      if (!AVATAR_TYPES.includes(file.type)) {
        return fail('validation', 'Formato de imagem não aceito.', {
          avatar: ['Use uma imagem PNG, JPG ou WebP'],
        })
      }
      if (file.size > AVATAR_MAX_BYTES) {
        return fail('validation', 'A imagem do avatar é grande demais.', {
          avatar: ['A imagem deve ter até 2 MB'],
        })
      }
      const avatarUrl = await toDataUrl(file)
      if (avatarUrl.length > AVATAR_MAX_LENGTH) {
        return fail('validation', 'A imagem do avatar é grande demais.', {
          avatar: ['Reduza a imagem (a simulação guarda até ~500 KB)'],
        })
      }
      return HttpResponse.json(setAvatar(user.id, avatarUrl))
    }),
  ),

  http.delete(
    `${API}/profile/avatar`,
    route(({ request }) => {
      const { user } = requireUser(request)
      return HttpResponse.json(setAvatar(user.id, null))
    }),
  ),
]
