import { z } from 'zod'
import { Count, EthString, Id, IsoDateTime, Version } from './common'
import { OrderStatus, TransactionRef } from './order'

/**
 * Campos comuns a todo evento:
 * - id: identidade estável, para descartar duplicatas;
 * - resource: recurso afetado;
 * - version: versão do recurso após o evento. O cliente ignora versões <= à que já tem.
 */
const eventBase = {
  id: Id,
  version: Version,
  occurredAt: IsoDateTime,
}

export const NftUpdatedEvent = z.object({
  ...eventBase,
  type: z.literal('nft.updated'),
  resource: z.object({ type: z.literal('nft'), id: Id }),
  payload: z.object({
    price: EthString,
    editions: z.array(z.object({ id: Id, available: Count })),
  }),
})
export type NftUpdatedEvent = z.infer<typeof NftUpdatedEvent>

export const OrderUpdatedEvent = z.object({
  ...eventBase,
  type: z.literal('order.updated'),
  resource: z.object({ type: z.literal('order'), id: Id }),
  /** Dono do pedido. O cliente descarta eventos de outro usuário. */
  userId: Id,
  payload: z.object({
    status: OrderStatus,
    transactionRef: TransactionRef.nullable(),
    rejectionReason: z.string().nullable(),
  }),
})
export type OrderUpdatedEvent = z.infer<typeof OrderUpdatedEvent>

export const RealtimeEvent = z.discriminatedUnion('type', [NftUpdatedEvent, OrderUpdatedEvent])
export type RealtimeEvent = z.infer<typeof RealtimeEvent>

export const REALTIME_EVENTS = {
  nftUpdated: 'nft.updated',
  orderUpdated: 'order.updated',
} as const

/** Mapa de eventos para tipar o socket.io-client: Socket<ServerToClientEvents>. */
export interface ServerToClientEvents {
  'nft.updated': (event: NftUpdatedEvent) => void
  'order.updated': (event: OrderUpdatedEvent) => void
}
