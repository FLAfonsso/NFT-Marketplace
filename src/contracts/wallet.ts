import { z } from 'zod'
import { Id, IsoDateTime } from './common'

export const WALLET_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/

export const WalletAddress = z
  .string()
  .trim()
  .regex(WALLET_ADDRESS_REGEX, 'Endereço deve ter 0x seguido de 40 caracteres hexadecimais')
export type WalletAddress = z.infer<typeof WalletAddress>

export const NETWORKS = ['ethereum', 'polygon', 'arbitrum', 'base'] as const
export const Network = z.enum(NETWORKS)
export type Network = z.infer<typeof Network>

export const WALLET_ROLES = ['primary', 'secondary'] as const
export const WalletRole = z.enum(WALLET_ROLES)
export type WalletRole = z.infer<typeof WalletRole>

export const Wallet = z.object({
  id: Id,
  label: z.string().min(1),
  address: WalletAddress,
  role: WalletRole,
  network: Network,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
})
export type Wallet = z.infer<typeof Wallet>

export const WalletInput = z.object({
  label: z.string().trim().min(1, 'Informe um nome para a carteira').max(40),
  address: WalletAddress,
  role: WalletRole,
  network: Network,
})
export type WalletInput = z.infer<typeof WalletInput>

export const WalletList = z.object({ items: z.array(Wallet) })
export type WalletList = z.infer<typeof WalletList>
