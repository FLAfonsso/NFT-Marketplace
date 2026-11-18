import { z } from 'zod'
import { Email, PersonName } from './auth'
import { CartItem } from './cart'
import { EthString, Id, IsoDateTime, Quantity, Version } from './common'
import { CouponCode } from './quote'
import { Network, WalletAddress } from './wallet'

export const ORDER_STATUSES = ['pending', 'confirmed', 'rejected'] as const
export const OrderStatus = z.enum(ORDER_STATUSES)
export type OrderStatus = z.infer<typeof OrderStatus>

/** "confirmed" e "rejected" são terminais. */
export const isTerminalOrderStatus = (status: OrderStatus) => status !== 'pending'

export const Buyer = z.object({
  name: PersonName,
  email: Email,
})
export type Buyer = z.infer<typeof Buyer>

export const CreateOrderInput = z.object({
  /** Mesma chave recupera o mesmo pedido; mesma chave com conteúdo diferente gera conflict. */
  idempotencyKey: z.uuid(),
  /** Cotação revisada pelo usuário. A API rejeita cotação desatualizada. */
  quoteId: Id,
  items: z.array(CartItem).min(1),
  couponCode: CouponCode.optional(),
  walletId: Id,
  network: Network,
  buyer: Buyer,
})
export type CreateOrderInput = z.infer<typeof CreateOrderInput>

/** Snapshot do item no momento da compra. Não muda com o catálogo. */
export const OrderItem = z
  .object({
    nftId: Id,
    editionId: Id,
    nftName: z.string(),
    editionName: z.string(),
    imageUrl: z.string(),
    quantity: Quantity,
    unitPrice: EthString,
    lineTotal: EthString,
  })
  .readonly()
export type OrderItem = z.infer<typeof OrderItem>

export const TX_HASH_REGEX = /^0x[0-9a-fA-F]{64}$/

/** Referência de transação simulada. */
export const TransactionRef = z
  .object({
    hash: z.string().regex(TX_HASH_REGEX),
    explorerUrl: z.url(),
  })
  .readonly()
export type TransactionRef = z.infer<typeof TransactionRef>

export const Order = z.object({
  id: Id,
  idempotencyKey: z.uuid(),
  status: OrderStatus,
  /** Snapshot imutável dos itens e valores. */
  snapshot: z
    .object({
      items: z.array(OrderItem).min(1).readonly(),
      couponCode: z.string().nullable(),
      subtotal: EthString,
      discount: EthString,
      networkFee: EthString,
      total: EthString,
      walletAddress: WalletAddress,
      network: Network,
      buyer: Buyer.readonly(),
    })
    .readonly(),
  /** Presente quando a transação simulada foi enviada. */
  transactionRef: TransactionRef.nullable(),
  rejectionReason: z.string().nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  version: Version,
})
export type Order = z.infer<typeof Order>
