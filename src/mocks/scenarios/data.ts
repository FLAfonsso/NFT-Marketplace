import { createSeed } from '../db/seed'
import type { CartKey, DbState } from '../db/types'
import { stableStringify } from '../db/util'
import type { ScenarioData } from './types'

/**
 * Ajustes do banco exigidos pelos cenários. Tudo é idempotente: aplicar o mesmo cenário
 * duas vezes não muda nada, e trocar de cenário desfaz o que o anterior exigia.
 */

const SEED_COUPONS = createSeed().coupons
/** Mesmo vencimento do cupom expirado do seed. */
const EXPIRED_AT = '2025-11-30T23:59:59.000Z'

const couponsFor = (mode: NonNullable<ScenarioData['coupons']>) => {
  if (mode === 'none') return []
  if (mode === 'expired') return SEED_COUPONS.map((c) => ({ ...c, expiresAt: EXPIRED_AT }))
  return SEED_COUPONS.map((c) => ({ ...c }))
}

const mapValues = <V, R>(record: Record<string, V>, fn: (value: V) => R) =>
  Object.fromEntries(Object.entries(record).map(([k, v]) => [k, fn(v)])) as Record<string, R>

/** Guarda os dados e deixa as listagens vazias. Usuários e sessões ficam intactos. */
const emptyCatalog = (db: DbState, now: string) => {
  db.stash = {
    nfts: db.nfts,
    favorites: db.favorites,
    carts: db.carts,
    wallets: db.wallets,
    orders: db.orders,
    quotes: db.quotes,
  }
  db.nfts = []
  db.orders = []
  db.quotes = {}
  db.favorites = mapValues(db.favorites, () => [])
  db.wallets = mapValues(db.wallets, () => [])
  db.carts = mapValues(db.carts, (cart) => ({
    ...cart,
    items: [],
    couponCode: null,
    updatedAt: now,
    version: cart.version + 1,
  })) as DbState['carts']
}

/**
 * Devolve os dados guardados. Versões de carrinho continuam crescendo; carteiras criadas
 * durante o "empty" só são mantidas para quem não tinha nenhuma antes.
 */
const restoreCatalog = (db: DbState, now: string) => {
  const { stash } = db
  if (!stash) return
  db.nfts = stash.nfts
  db.orders = stash.orders
  db.quotes = stash.quotes
  db.favorites = stash.favorites
  db.wallets = { ...db.wallets }
  for (const [userId, list] of Object.entries(stash.wallets)) {
    if (list.length > 0 || !db.wallets[userId]) db.wallets[userId] = list
  }
  const carts = { ...db.carts }
  for (const key of Object.keys(stash.carts) as CartKey[]) {
    const saved = stash.carts[key]
    const current = carts[key]
    carts[key] = {
      ...saved,
      updatedAt: current ? now : saved.updatedAt,
      version: Math.max(saved.version, current?.version ?? 0) + (current ? 1 : 0),
    }
  }
  db.carts = carts
  delete db.stash
}

/** true se o banco não está no estado que o cenário exige. */
export const needsDataSync = (db: Readonly<DbState>, data: ScenarioData = {}) =>
  (data.catalog === 'empty') !== Boolean(db.stash) ||
  stableStringify(db.coupons) !== stableStringify(couponsFor(data.coupons ?? 'seed'))

/** Leva o banco ao estado exigido pelo cenário. Chamar dentro de transact. */
export const applyScenarioData = (db: DbState, data: ScenarioData = {}, now: string) => {
  const wantEmpty = data.catalog === 'empty'
  if (wantEmpty && !db.stash) emptyCatalog(db, now)
  else if (!wantEmpty && db.stash) restoreCatalog(db, now)
  db.coupons = couponsFor(data.coupons ?? 'seed')
}
