import { z } from 'zod'
import { CartItem } from './cart'
import { Count, EthString, Id, IsoDateTime, Quantity, Version } from './common'

export const CouponCode = z.string().trim().min(1).max(32).toUpperCase()
export type CouponCode = z.infer<typeof CouponCode>

export const QuoteRequest = z.object({
  items: z.array(CartItem).min(1),
  couponCode: CouponCode.optional(),
})
export type QuoteRequest = z.infer<typeof QuoteRequest>

export const QuoteLine = z.object({
  nftId: Id,
  editionId: Id,
  quantity: Quantity,
  unitPrice: EthString,
  lineTotal: EthString,
  /** Versão do NFT usada na cotação, para detectar cotação desatualizada. */
  nftVersion: Version,
})
export type QuoteLine = z.infer<typeof QuoteLine>

export const COUPON_STATUSES = ['applied', 'invalid', 'expired'] as const
export const CouponStatus = z.enum(COUPON_STATUSES)
export type CouponStatus = z.infer<typeof CouponStatus>

export const QuoteCoupon = z.object({
  code: z.string(),
  status: CouponStatus,
  message: z.string().optional(),
})
export type QuoteCoupon = z.infer<typeof QuoteCoupon>

export const PriceChangedWarning = z.object({
  type: z.literal('price_changed'),
  nftId: Id,
  editionId: Id,
  previousPrice: EthString,
  currentPrice: EthString,
})
export type PriceChangedWarning = z.infer<typeof PriceChangedWarning>

export const UnavailableWarning = z.object({
  type: z.literal('unavailable'),
  nftId: Id,
  editionId: Id,
  requested: Quantity,
  available: Count,
})
export type UnavailableWarning = z.infer<typeof UnavailableWarning>

export const QuoteWarning = z.discriminatedUnion('type', [
  PriceChangedWarning,
  UnavailableWarning,
])
export type QuoteWarning = z.infer<typeof QuoteWarning>

export const Quote = z.object({
  id: Id,
  items: z.array(QuoteLine),
  coupon: QuoteCoupon.nullable(),
  subtotal: EthString,
  discount: EthString,
  networkFee: EthString,
  total: EthString,
  warnings: z.array(QuoteWarning),
  createdAt: IsoDateTime,
  expiresAt: IsoDateTime,
})
export type Quote = z.infer<typeof Quote>

/** Aplica (ou remove, com null) o cupom guardado no carrinho. */
export const SetCartCouponInput = z.object({ couponCode: CouponCode.nullable() })
export type SetCartCouponInput = z.infer<typeof SetCartCouponInput>
