import { http, HttpResponse } from 'msw'
import {
  CreateOrderInput,
  type Order,
  type OrderConflict,
  type OrderList,
  type Quote,
} from '@/contracts'
import {
  mutateNft,
  nextId,
  read,
  scheduleSettlement,
  settleDelayMs,
  transact,
  userCartKey,
} from '../db/store'
import type { OrderRecord } from '../db/types'
import { deepFreeze, Eth, stableStringify } from '../db/util'
import { IDEMPOTENCY_HEADER } from './http'
import { createQuote } from './quote'
import { API, fail, jsonError, param, parseBody, requireUser, route } from './utils'

export { IDEMPOTENCY_HEADER }

type CreateResult =
  | { kind: 'created' | 'replayed'; record: OrderRecord }
  | { kind: 'price_changed'; quote: Quote; nftName: string }

const itemKey = (i: { nftId: string; editionId: string }) => `${i.nftId}:${i.editionId}`

/** Conteúdo do pedido normalizado, sem a chave, para comparar tentativas. */
const fingerprintOf = (input: CreateOrderInput) => {
  const { idempotencyKey: _key, ...content } = input
  void _key
  return stableStringify({
    ...content,
    couponCode: content.couponCode ?? null,
    items: [...content.items].sort((a, b) => itemKey(a).localeCompare(itemKey(b))),
  })
}

const sameItems = (a: CreateOrderInput['items'], b: { nftId: string; editionId: string; quantity: number }[]) =>
  a.length === b.length &&
  a.every((item) =>
    b.some((other) => itemKey(other) === itemKey(item) && other.quantity === item.quantity),
  )

export const orderHandlers = [
  http.post(
    `${API}/orders`,
    route(async ({ request }) => {
      const { user } = requireUser(request)
      const headerKey = request.headers.get(IDEMPOTENCY_HEADER)?.trim().toLowerCase()
      if (!headerKey) {
        fail('validation', `Cabeçalho ${IDEMPOTENCY_HEADER} é obrigatório.`, {
          [IDEMPOTENCY_HEADER]: ['Obrigatório'],
        })
      }
      const input = await parseBody(request, CreateOrderInput)
      const key = input.idempotencyKey.toLowerCase()
      if (key !== headerKey) {
        fail('validation', `${IDEMPOTENCY_HEADER} difere de idempotencyKey no corpo.`, {
          idempotencyKey: ['Deve ser igual ao cabeçalho'],
        })
      }
      const fingerprint = fingerprintOf({ ...input, idempotencyKey: key })

      const result = transact((db, tx): CreateResult => {
        // 1. Idempotência: vale antes de qualquer outra validação, para a nova tentativa
        //    recuperar o pedido mesmo se a cotação já expirou.
        const existing = db.orders.find(
          (r) => r.userId === user.id && r.order.idempotencyKey === key,
        )
        if (existing) {
          if (existing.fingerprint !== fingerprint) {
            fail('conflict', 'Esta chave de idempotência já foi usada com outro conteúdo.')
          }
          return { kind: 'replayed', record: existing }
        }

        // 2. Cotação revisada.
        const quoteRecord = db.quotes[input.quoteId]
        if (!quoteRecord) return fail('not_found', 'Cotação não encontrada ou expirada.')
        if (quoteRecord.actor !== userCartKey(user.id)) {
          fail('forbidden', 'Esta cotação pertence a outra sessão.')
        }
        const { quote } = quoteRecord
        if (Date.parse(quote.expiresAt) <= Date.parse(tx.now)) {
          fail('conflict', 'A cotação expirou. Revise o pedido novamente.')
        }
        if (
          !sameItems(input.items, quote.items) ||
          (input.couponCode ?? null) !== quoteRecord.requestedCoupon
        ) {
          fail('conflict', 'Os itens ou o cupom diferem da cotação revisada.')
        }

        // 3. Carteira.
        const wallet = (db.wallets[user.id] ?? []).find((w) => w.id === input.walletId)
        if (!wallet) {
          const ownedByOther = Object.values(db.wallets).some((list) =>
            list.some((w) => w.id === input.walletId),
          )
          return ownedByOther
            ? fail('forbidden', 'Esta carteira pertence a outro usuário.')
            : fail('not_found', 'Carteira não encontrada.', { walletId: ['Carteira inexistente'] })
        }
        if (wallet.address.toLowerCase() !== input.address.toLowerCase()) {
          fail('validation', 'O endereço não corresponde à carteira escolhida.', {
            address: ['Use o endereço da carteira selecionada'],
          })
        }
        if (wallet.network !== input.network) {
          fail('validation', 'A rede não corresponde à carteira escolhida.', {
            network: [`A carteira está na rede ${wallet.network}`],
          })
        }

        // 4. Preço atual. Se mudou, a cotação é substituída por uma nova (com aviso
        //    price_changed), que segue no corpo do 409 para o usuário revisar. A transação
        //    é confirmada para a cotação nova existir; nada mais foi alterado até aqui.
        const repriced = quote.items
          .map((line) => db.nfts.find((n) => n.id === line.nftId && !new Eth(n.price).eq(line.unitPrice)))
          .find((nft) => nft !== undefined)
        if (repriced) {
          delete db.quotes[quote.id]
          const fresh = createQuote(db, tx, userCartKey(user.id), {
            items: quote.items.map(({ nftId, editionId, quantity }) => ({ nftId, editionId, quantity })),
            couponCode: quoteRecord.requestedCoupon ?? undefined,
          })
          return { kind: 'price_changed', quote: fresh, nftName: repriced.name }
        }

        // 5. Disponibilidade atual.
        const items = quote.items.map((line) => {
          const nft = db.nfts.find((n) => n.id === line.nftId)
          const edition = nft?.editions.find((e) => e.id === line.editionId)
          if (!nft || !edition) return fail('not_found', 'Um item do pedido não existe mais.')
          if (edition.available < line.quantity) {
            const soldOut = edition.available === 0
            throw jsonError<OrderConflict>({
              code: 'conflict',
              reason: soldOut ? 'sold_out' : 'insufficient_stock',
              message: soldOut
                ? `A edição ${edition.name} de ${nft.name} esgotou.`
                : `Só há ${edition.available} unidade(s) de ${nft.name}.`,
              nftId: nft.id,
              editionId: edition.id,
              available: edition.available,
            })
          }
          return {
            nftId: nft.id,
            editionId: edition.id,
            nftName: nft.name,
            editionName: edition.name,
            imageUrl: nft.gallery[0].url,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
          }
        })

        // 6. Reserva o estoque enquanto o pagamento está pendente.
        for (const item of items) {
          mutateNft(db, tx, item.nftId, (nft) => {
            const edition = nft.editions.find((e) => e.id === item.editionId)
            if (edition) edition.available -= item.quantity
          })
        }

        const order: Order = {
          id: nextId(db, 'ord'),
          idempotencyKey: key,
          status: 'pending',
          snapshot: deepFreeze({
            items,
            couponCode: quote.coupon?.status === 'applied' ? quote.coupon.code : null,
            subtotal: quote.subtotal,
            discount: quote.discount,
            networkFee: quote.networkFee,
            total: quote.total,
            walletAddress: wallet.address,
            network: wallet.network,
            buyer: { name: input.displayName, email: input.email },
          }),
          transactionRef: null,
          rejectionReason: null,
          createdAt: tx.now,
          updatedAt: tx.now,
          version: 1,
        }
        const record: OrderRecord = {
          order,
          userId: user.id,
          fingerprint,
          settleAt: new Date(Date.parse(tx.now) + settleDelayMs()).toISOString(),
        }
        db.orders.push(record)
        // Cotação de uso único: outra chave não consegue reaproveitá-la.
        delete db.quotes[quote.id]
        tx.emit({ type: 'order.updated', order: structuredClone(order), userId: user.id, occurredAt: tx.now })
        return { kind: 'created', record }
      })

      if (result.kind === 'price_changed') {
        return jsonError<OrderConflict>({
          code: 'conflict',
          reason: 'price_changed',
          message: `O preço de ${result.nftName} mudou. Revise a nova cotação.`,
          quote: result.quote,
        })
      }
      const replayed = result.kind === 'replayed'
      if (!replayed) scheduleSettlement(result.record)
      return HttpResponse.json<Order>(result.record.order, {
        status: replayed ? 200 : 201,
        headers: replayed ? { 'Idempotent-Replayed': 'true' } : undefined,
      })
    }),
  ),

  http.get(
    `${API}/orders`,
    route(({ request }) => {
      const { user } = requireUser(request)
      const items = read()
        .orders.filter((r) => r.userId === user.id)
        .map((r) => r.order)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      return HttpResponse.json<OrderList>({ items })
    }),
  ),

  http.get(
    `${API}/orders/:id`,
    route(({ request, params }) => {
      const { user } = requireUser(request)
      const record = read().orders.find((r) => r.order.id === param(params, 'id'))
      if (!record) return fail('not_found', 'Pedido não encontrado.')
      if (record.userId !== user.id) return fail('forbidden', 'Este pedido pertence a outro usuário.')
      return HttpResponse.json<Order>(record.order)
    }),
  ),
]
