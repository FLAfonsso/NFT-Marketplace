import type { Cart, Nft, Order } from '@/contracts'
import { mockSettings, resetSettings } from '../settings'
import { createSeed, REJECTING_ADDRESS_SUFFIX, SCHEMA_VERSION } from './seed'
import type { CartKey, DbState, OrderRecord } from './types'
import { transactionRefFor } from './util'

/**
 * Estado em memória da simulação, persistido no localStorage para sobreviver ao refresh.
 * Toda escrita passa por `transact`, que persiste e só então publica os eventos de mudança.
 */

const STORAGE_KEY = 'nft-marketplace:mocks:db'

// ---------------------------------------------------------------------------
// Emissor interno de mudanças (consumido depois pela camada de Socket.IO)
// ---------------------------------------------------------------------------

export type StoreEvent =
  | { type: 'nft.updated'; nft: Nft; occurredAt: string }
  | { type: 'order.updated'; order: Order; userId: string; occurredAt: string }

type Listener = (event: StoreEvent) => void
const listeners = new Set<Listener>()

/** Assina mudanças do store. Devolve a função de cancelamento. */
export const subscribe = (listener: Listener) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const publish = (events: StoreEvent[]) => {
  for (const event of events) {
    for (const listener of listeners) {
      try {
        listener(event)
      } catch (error) {
        console.error('[mocks] listener do store falhou', error)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Persistência
// ---------------------------------------------------------------------------

const readStorage = (): DbState | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DbState
    return parsed?.schemaVersion === SCHEMA_VERSION ? parsed : null
  } catch {
    return null
  }
}

const writeStorage = (db: DbState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch (error) {
    console.warn('[mocks] não foi possível persistir o estado', error)
  }
}

let state: DbState = readStorage() ?? createSeed()

/** Estado atual, somente leitura. Para alterar, use `transact`. */
export const read = (): Readonly<DbState> => state

export interface TxContext {
  emit: (event: StoreEvent) => void
  now: string
}

/** Executa uma alteração atômica: aplica, persiste e publica eventos. */
export const transact = <T>(fn: (db: DbState, tx: TxContext) => T): T => {
  const events: StoreEvent[] = []
  const draft = structuredClone(state)
  const result = fn(draft, { emit: (e) => events.push(e), now: new Date().toISOString() })
  state = draft
  writeStorage(state)
  publish(events)
  return result
}

/** Gera um id determinístico (sequência do estado). */
export const nextId = (db: DbState, prefix: string) => `${prefix}_${++db.seq}`

/** Restaura exatamente o seed e as configurações padrão. */
export const reset = () => {
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
  resetSettings()
  state = createSeed()
  writeStorage(state)
}

// ---------------------------------------------------------------------------
// Operações de domínio compartilhadas
// ---------------------------------------------------------------------------

export const userCartKey = (userId: string): CartKey => `user:${userId}`
export const guestCartKey = (guestId: string): CartKey => `guest:${guestId}`

/** Carrinho da chave, criado vazio se não existir. */
export const ensureCart = (db: DbState, key: CartKey, now: string): Cart => {
  const existing = db.carts[key]
  if (existing) return existing
  const id = key.startsWith('user:') ? `cart_${key.slice(5)}` : `cart_guest_${key.slice(6)}`
  const cart: Cart = { id, items: [], couponCode: null, updatedAt: now, version: 0 }
  db.carts[key] = cart
  return cart
}

export const touchCart = (cart: Cart, now: string) => {
  cart.updatedAt = now
  cart.version += 1
}

/**
 * Junta o carrinho de visitante ao do usuário: soma quantidades respeitando o limite por
 * pedido, mantém o cupom do usuário (ou adota o do visitante) e apaga o carrinho de visitante.
 */
export const mergeGuestCart = (db: DbState, guestId: string, userId: string, now: string) => {
  const guest = db.carts[guestCartKey(guestId)]
  if (!guest) return
  const cart = ensureCart(db, userCartKey(userId), now)
  for (const item of guest.items) {
    const edition = db.nfts
      .find((n) => n.id === item.nftId)
      ?.editions.find((e) => e.id === item.editionId)
    if (!edition) continue
    const current = cart.items.find(
      (i) => i.nftId === item.nftId && i.editionId === item.editionId,
    )
    const quantity = Math.min((current?.quantity ?? 0) + item.quantity, edition.maxPerOrder)
    if (current) current.quantity = quantity
    else cart.items.push({ ...item, quantity })
  }
  cart.couponCode ??= guest.couponCode
  touchCart(cart, now)
  delete db.carts[guestCartKey(guestId)]
}

/** Altera um NFT, incrementa a versão e emite `nft.updated`. */
export const mutateNft = (
  db: DbState,
  tx: TxContext,
  nftId: string,
  change: (nft: Nft) => void,
): Nft | undefined => {
  const nft = db.nfts.find((n) => n.id === nftId)
  if (!nft) return undefined
  change(nft)
  nft.version += 1
  tx.emit({ type: 'nft.updated', nft: structuredClone(nft), occurredAt: tx.now })
  return nft
}

/** API para a futura camada de tempo real e para cenários: altera um NFT fora de uma requisição. */
export const updateNft = (nftId: string, change: (nft: Nft) => void) =>
  transact((db, tx) => mutateNft(db, tx, nftId, change))

// ---------------------------------------------------------------------------
// Liquidação de pedidos
// ---------------------------------------------------------------------------

const timers = new Map<string, ReturnType<typeof setTimeout>>()

export type SettlementOutcome = 'confirmed' | 'rejected'

/** Resultado forçado pelos cenários de pagamento. null: regra da carteira (sufixo "dead"). */
let forcedOutcome: SettlementOutcome | null = null

/** Usado por src/mocks/scenarios. Vale para pedidos liquidados a partir de agora. */
export const forceSettlementOutcome = (outcome: SettlementOutcome | null) => {
  forcedOutcome = outcome
}

const settleOrder = (orderId: string) => {
  timers.delete(orderId)
  transact((db, tx) => {
    const record = db.orders.find((r) => r.order.id === orderId)
    if (!record || record.order.status !== 'pending') return
    const { order } = record
    const rejected = forcedOutcome
      ? forcedOutcome === 'rejected'
      : order.snapshot.walletAddress.toLowerCase().endsWith(REJECTING_ADDRESS_SUFFIX)

    if (rejected) {
      // Devolve o estoque reservado na criação.
      for (const item of order.snapshot.items) {
        mutateNft(db, tx, item.nftId, (nft) => {
          const edition = nft.editions.find((e) => e.id === item.editionId)
          if (edition) edition.available = Math.min(edition.supply, edition.available + item.quantity)
        })
      }
    } else {
      // Remove do carrinho apenas o que foi comprado.
      const cart = db.carts[userCartKey(record.userId)]
      if (cart) {
        for (const item of order.snapshot.items) {
          const line = cart.items.find(
            (i) => i.nftId === item.nftId && i.editionId === item.editionId,
          )
          if (line) line.quantity -= item.quantity
        }
        cart.items = cart.items.filter((i) => i.quantity > 0)
        if (cart.couponCode && cart.couponCode === order.snapshot.couponCode) cart.couponCode = null
        touchCart(cart, tx.now)
      }
    }

    // O snapshot não é tocado: só estado, referência e versão mudam.
    record.order = {
      ...order,
      status: rejected ? 'rejected' : 'confirmed',
      transactionRef: rejected ? null : transactionRefFor(order.id, order.snapshot.network),
      rejectionReason: rejected ? 'Pagamento recusado pela carteira.' : null,
      updatedAt: tx.now,
      version: order.version + 1,
    }
    tx.emit({
      type: 'order.updated',
      order: structuredClone(record.order),
      userId: record.userId,
      occurredAt: tx.now,
    })
  })
}

/** Agenda a liquidação de um pedido pendente para `settleAt`. */
export const scheduleSettlement = (record: Pick<OrderRecord, 'order' | 'settleAt'>) => {
  if (record.order.status !== 'pending' || timers.has(record.order.id)) return
  const wait = Math.max(0, Date.parse(record.settleAt) - Date.now())
  timers.set(
    record.order.id,
    setTimeout(() => settleOrder(record.order.id), wait),
  )
}

export const settleDelayMs = () => mockSettings.orderSettleMs

/** Agenda todos os pedidos pendentes ainda sem timer (após refresh ou troca de cenário). */
export const rescheduleSettlements = () => {
  for (const record of state.orders) scheduleSettlement(record)
}

// Pedidos que estavam pendentes antes do refresh continuam a ser liquidados.
rescheduleSettlements()

// Mantém abas sincronizadas: outra aba gravou um estado novo.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return
    const next = readStorage()
    if (next) {
      state = next
      rescheduleSettlements()
    }
  })
}
