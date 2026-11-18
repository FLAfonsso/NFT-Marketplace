import { z } from 'zod'
import { Email, PersonName } from './auth'
import { CartItem } from './cart'
import { ApiError, Count, EthString, Id, IsoDateTime, Quantity, Version } from './common'
import { CouponCode, Quote } from './quote'
import { CollectorFormFields, Network, WalletAddress } from './wallet'

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

export const CreateOrderInput = CollectorFormFields.extend({
  /** Mesma chave recupera o mesmo pedido; mesma chave com conteúdo diferente gera conflict. */
  idempotencyKey: z.uuid(),
  /** Cotação revisada pelo usuário. A API rejeita cotação desatualizada. */
  quoteId: Id,
  items: z.array(CartItem).min(1),
  couponCode: CouponCode.optional(),
  /** Carteira cadastrada usada na compra. `address` e `network` devem coincidir com ela. */
  walletId: Id,
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

export const OrderList = z.object({ items: z.array(Order) })
export type OrderList = z.infer<typeof OrderList>

const OrderConflictBase = ApiError.extend({ code: z.literal('conflict') })

const StockConflictFields = { nftId: Id, editionId: Id, available: Count }

/**
 * Corpo do 409 de POST /orders quando o catálogo mudou desde a cotação.
 * - price_changed: traz a cotação nova (que substitui a antiga) para o usuário revisar.
 * - sold_out / insufficient_stock: a edição esgotou ou não tem a quantidade pedida.
 * Outros 409 do pedido (cotação vencida, chave reutilizada) são ApiError simples.
 */
export const OrderConflict = z.discriminatedUnion('reason', [
  OrderConflictBase.extend({ reason: z.literal('price_changed'), quote: Quote }),
  OrderConflictBase.extend({ reason: z.literal('sold_out'), ...StockConflictFields }),
  OrderConflictBase.extend({ reason: z.literal('insufficient_stock'), ...StockConflictFields }),
])
export type OrderConflict = z.infer<typeof OrderConflict>
