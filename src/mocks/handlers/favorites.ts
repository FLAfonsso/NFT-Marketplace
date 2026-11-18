import { http, HttpResponse } from 'msw'
import type { FavoriteList } from '@/contracts'
import { read, transact } from '../db/store'
import type { DbState } from '../db/types'
import { API, fail, param, requireUser, route } from './utils'

const listFor = (db: Readonly<DbState>, userId: string): FavoriteList => ({
  items: (db.favorites[userId] ?? []).flatMap((id) => db.nfts.filter((n) => n.id === id)),
})

const ensureNft = (nftId: string) => {
  if (!read().nfts.some((n) => n.id === nftId)) fail('not_found', 'NFT não encontrado.')
}

export const favoriteHandlers = [
  http.get(
    `${API}/favorites`,
    route(({ request }) => {
      const { user } = requireUser(request)
      return HttpResponse.json(listFor(read(), user.id))
    }),
  ),

  /** Idempotente: favoritar duas vezes mantém um único registro. */
  http.put(
    `${API}/favorites/:nftId`,
    route(({ request, params }) => {
      const { user } = requireUser(request)
      const nftId = param(params, 'nftId')
      ensureNft(nftId)
      const list = transact((db) => {
        const current = db.favorites[user.id] ?? []
        if (!current.includes(nftId)) db.favorites[user.id] = [nftId, ...current]
        return listFor(db, user.id)
      })
      return HttpResponse.json(list)
    }),
  ),

  /** Idempotente: remover algo que não está nos favoritos responde a lista atual. */
  http.delete(
    `${API}/favorites/:nftId`,
    route(({ request, params }) => {
      const { user } = requireUser(request)
      const nftId = param(params, 'nftId')
      const list = transact((db) => {
        db.favorites[user.id] = (db.favorites[user.id] ?? []).filter((id) => id !== nftId)
        return listFor(db, user.id)
      })
      return HttpResponse.json(list)
    }),
  ),
]
