import { http, HttpResponse } from 'msw'
import { AddCartItemInput, SetCartCouponInput, UpdateCartItemInput, type Cart } from '@/contracts'
import { ensureCart, read, touchCart, transact } from '../db/store'
import type { DbState } from '../db/types'
import { API, fail, param, parseBody, resolveActor, route } from './utils'

const findEdition = (db: Readonly<DbState>, nftId: string, editionId: string) => {
  const nft = db.nfts.find((n) => n.id === nftId)
  if (!nft) return fail('not_found', 'NFT não encontrado.')
  const edition = nft.editions.find((e) => e.id === editionId)
  if (!edition) return fail('not_found', 'Edição não encontrada.')
  return { nft, edition }
}

/** Valida limite por pedido (400) e estoque (409) para a quantidade final do item. */
const checkQuantity = (db: Readonly<DbState>, nftId: string, editionId: string, quantity: number) => {
  const { nft, edition } = findEdition(db, nftId, editionId)
  if (quantity > edition.maxPerOrder) {
    fail('validation', `Limite de ${edition.maxPerOrder} unidade(s) por pedido.`, {
      quantity: [`Máximo de ${edition.maxPerOrder}`],
    })
  }
  if (edition.available === 0) fail('conflict', `A edição ${edition.name} de ${nft.name} esgotou.`)
  if (quantity > edition.available) {
    fail('conflict', `Só há ${edition.available} unidade(s) disponível(is) de ${nft.name}.`)
  }
}

export const cartHandlers = [
  http.get(
    `${API}/cart`,
    route(({ request }) => {
      const actor = resolveActor(request)
      const existing = read().carts[actor.key]
      const cart = existing ?? transact((db, tx) => ensureCart(db, actor.key, tx.now))
      return HttpResponse.json<Cart>(cart)
    }),
  ),

  /** Inclui um item; se o par nftId+editionId já existe, soma a quantidade. */
  http.post(
    `${API}/cart/items`,
    route(async ({ request }) => {
      const actor = resolveActor(request)
      const input = await parseBody(request, AddCartItemInput)
      const cart = transact((db, tx) => {
        const cart = ensureCart(db, actor.key, tx.now)
        const line = cart.items.find(
          (i) => i.nftId === input.nftId && i.editionId === input.editionId,
        )
        const quantity = (line?.quantity ?? 0) + input.quantity
        checkQuantity(db, input.nftId, input.editionId, quantity)
        if (line) line.quantity = quantity
        else cart.items.push({ ...input })
        touchCart(cart, tx.now)
        return cart
      })
      return HttpResponse.json<Cart>(cart, { status: 201 })
    }),
  ),

  /** Define a quantidade de um item existente. */
  http.patch(
    `${API}/cart/items`,
    route(async ({ request }) => {
      const actor = resolveActor(request)
      const input = await parseBody(request, UpdateCartItemInput)
      const cart = transact((db, tx) => {
        const cart = ensureCart(db, actor.key, tx.now)
        const line = cart.items.find(
          (i) => i.nftId === input.nftId && i.editionId === input.editionId,
        )
        if (!line) return fail('not_found', 'Item não está no carrinho.')
        checkQuantity(db, input.nftId, input.editionId, input.quantity)
        line.quantity = input.quantity
        touchCart(cart, tx.now)
        return cart
      })
      return HttpResponse.json<Cart>(cart)
    }),
  ),

  /** Idempotente: remover item ausente devolve o carrinho atual. */
  http.delete(
    `${API}/cart/items/:nftId/:editionId`,
    route(({ request, params }) => {
      const actor = resolveActor(request)
      const nftId = param(params, 'nftId')
      const editionId = param(params, 'editionId')
      const cart = transact((db, tx) => {
        const cart = ensureCart(db, actor.key, tx.now)
        const before = cart.items.length
        cart.items = cart.items.filter((i) => !(i.nftId === nftId && i.editionId === editionId))
        if (cart.items.length !== before) touchCart(cart, tx.now)
        return cart
      })
      return HttpResponse.json<Cart>(cart)
    }),
  ),

  /** Guarda (ou remove) o cupom do carrinho. A validade é verificada na cotação. */
  http.put(
    `${API}/cart/coupon`,
    route(async ({ request }) => {
      const actor = resolveActor(request)
      const input = await parseBody(request, SetCartCouponInput)
      const cart = transact((db, tx) => {
        const cart = ensureCart(db, actor.key, tx.now)
        cart.couponCode = input.couponCode
        touchCart(cart, tx.now)
        return cart
      })
      return HttpResponse.json<Cart>(cart)
    }),
  ),
]
