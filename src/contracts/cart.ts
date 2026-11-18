import { z } from 'zod'
import { Id, IsoDateTime, Quantity, Version } from './common'

/** Um item é identificado pelo par nftId + editionId. */
export const CartItem = z.object({
  nftId: Id,
  editionId: Id,
  quantity: Quantity,
})
export type CartItem = z.infer<typeof CartItem>

export const Cart = z.object({
  id: Id,
  items: z.array(CartItem),
  couponCode: z.string().nullable(),
  updatedAt: IsoDateTime,
  version: Version,
})
export type Cart = z.infer<typeof Cart>

export const AddCartItemInput = CartItem
export type AddCartItemInput = z.infer<typeof AddCartItemInput>

export const UpdateCartItemInput = CartItem
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemInput>
