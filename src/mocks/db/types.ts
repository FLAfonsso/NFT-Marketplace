import type { Cart, EthString, Nft, Order, Quote, Wallet } from '@/contracts'

/** Registro interno de usuário. Nunca sai do mock como está: as respostas usam User/Profile. */
export interface UserRecord {
  id: string
  name: string
  email: string
  username: string
  ensName: string | null
  avatarUrl: string | null
  /** PBKDF2-SHA256 em hex. */
  passwordHash: string
  /** Salt aleatório em hex. */
  passwordSalt: string
  createdAt: string
  updatedAt: string
  version: number
}

export interface SessionRecord {
  token: string
  userId: string
  createdAt: string
  expiresAt: string
}

export interface CouponRecord {
  code: string
  kind: 'percent' | 'fixed'
  /** Percentual (ex.: "10") ou valor fixo em ETH. */
  value: EthString
  /** Teto do desconto em ETH, para cupons percentuais. */
  maxDiscount: EthString | null
  expiresAt: string
}

export interface QuoteRecord {
  quote: Quote
  /** Dono da cotação: `user:<id>` ou `guest:<id>`. */
  actor: string
  /** Cupom pedido na cotação, já normalizado. */
  requestedCoupon: string | null
}

export interface OrderRecord {
  order: Order
  userId: string
  /** Impressão digital do conteúdo do pedido, para detectar reuso da chave com outro conteúdo. */
  fingerprint: string
  /** Instante em que o pedido pendente deve ser liquidado. */
  settleAt: string
}

/** Chave do carrinho: `user:<id>` ou `guest:<uuid>`. */
export type CartKey = `user:${string}` | `guest:${string}`

export interface DbState {
  schemaVersion: number
  /** Sequência para ids gerados em tempo de execução (determinística a partir do seed). */
  seq: number
  users: UserRecord[]
  sessions: Record<string, SessionRecord>
  nfts: Nft[]
  coupons: CouponRecord[]
  /** userId → nftIds, do mais recente para o mais antigo. */
  favorites: Record<string, string[]>
  carts: Record<CartKey, Cart>
  /** userId → carteiras. */
  wallets: Record<string, Wallet[]>
  quotes: Record<string, QuoteRecord>
  /** actor → "nftId:editionId" → último preço cotado, para avisar mudança de preço. */
  lastQuotedPrices: Record<string, Record<string, EthString>>
  orders: OrderRecord[]
  /**
   * Dados guardados enquanto o cenário "empty" está ativo (as listagens ficam vazias).
   * Restaurados ao sair dele. Ver src/mocks/scenarios/data.ts.
   */
  stash?: CatalogStash
}

export type CatalogStash = Pick<DbState, 'nfts' | 'favorites' | 'carts' | 'wallets' | 'orders' | 'quotes'>
