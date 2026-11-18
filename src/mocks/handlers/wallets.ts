import { http, HttpResponse } from 'msw'
import { WalletInput, type Wallet, type WalletList } from '@/contracts'
import { nextId, read, transact } from '../db/store'
import type { DbState } from '../db/types'
import { API, fail, param, parseBody, requireUser, route } from './utils'

const duplicate = () =>
  fail('conflict', 'Esta carteira já está cadastrada.', { address: ['Endereço já cadastrado'] })

/** Garante uma única carteira principal: promover uma rebaixa as demais. */
const promote = (list: Wallet[], walletId: string, now: string) => {
  for (const w of list) {
    if (w.id !== walletId && w.role === 'primary') {
      w.role = 'secondary'
      w.updatedAt = now
    }
  }
}

const ownedByOther = (db: Readonly<DbState>, userId: string, walletId: string) =>
  Object.entries(db.wallets).some(
    ([owner, list]) => owner !== userId && list.some((w) => w.id === walletId),
  )

export const walletHandlers = [
  http.get(
    `${API}/wallets`,
    route(({ request }) => {
      const { user } = requireUser(request)
      return HttpResponse.json<WalletList>({ items: read().wallets[user.id] ?? [] })
    }),
  ),

  http.post(
    `${API}/wallets`,
    route(async ({ request }) => {
      const { user } = requireUser(request)
      const input = await parseBody(request, WalletInput)
      const wallet = transact((db, tx) => {
        const list = (db.wallets[user.id] ??= [])
        const address = input.address.toLowerCase()
        if (list.some((w) => w.address.toLowerCase() === address)) duplicate()
        const wallet: Wallet = {
          id: nextId(db, 'wal'),
          ...input,
          // A primeira carteira é sempre a principal.
          role: list.length === 0 ? 'primary' : input.role,
          createdAt: tx.now,
          updatedAt: tx.now,
        }
        list.push(wallet)
        if (wallet.role === 'primary') promote(list, wallet.id, tx.now)
        return wallet
      })
      return HttpResponse.json(wallet, { status: 201 })
    }),
  ),

  http.put(
    `${API}/wallets/:id`,
    route(async ({ request, params }) => {
      const { user } = requireUser(request)
      const walletId = param(params, 'id')
      const input = await parseBody(request, WalletInput)
      const wallet = transact((db, tx) => {
        const list = db.wallets[user.id] ?? []
        const wallet = list.find((w) => w.id === walletId)
        if (!wallet) {
          return ownedByOther(db, user.id, walletId)
            ? fail('forbidden', 'Esta carteira pertence a outro usuário.')
            : fail('not_found', 'Carteira não encontrada.')
        }
        const address = input.address.toLowerCase()
        if (list.some((w) => w.id !== walletId && w.address.toLowerCase() === address)) duplicate()
        if (wallet.role === 'primary' && input.role === 'secondary') {
          fail('conflict', 'Defina outra carteira como principal antes de rebaixar esta.', {
            role: ['É preciso ter uma carteira principal'],
          })
        }
        Object.assign(wallet, input, { updatedAt: tx.now })
        if (wallet.role === 'primary') promote(list, wallet.id, tx.now)
        return wallet
      })
      return HttpResponse.json(wallet)
    }),
  ),
]
