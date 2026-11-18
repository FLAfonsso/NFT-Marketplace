import { z } from 'zod'
import { Email, PersonName } from './auth'
import { Id, IsoDateTime } from './common'

export const WALLET_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/

export const WalletAddress = z
  .string()
  .trim()
  .regex(WALLET_ADDRESS_REGEX, 'Endereço deve ter 0x seguido de 40 caracteres hexadecimais')
export type WalletAddress = z.infer<typeof WalletAddress>

export const NETWORKS = ['ethereum', 'polygon', 'base'] as const
export const Network = z.enum(NETWORKS)
export type Network = z.infer<typeof Network>

export const WALLET_ROLES = ['primary', 'secondary'] as const
export const WalletRole = z.enum(WALLET_ROLES)
export type WalletRole = z.infer<typeof WalletRole>

export const WALLET_TYPES = ['MetaMask', 'WalletConnect', 'Coinbase Wallet'] as const
export const WalletType = z.enum(WALLET_TYPES)
export type WalletType = z.infer<typeof WalletType>

export const ENS_NAME_REGEX = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/i
export const EnsName = z
  .string()
  .trim()
  .toLowerCase()
  .regex(ENS_NAME_REGEX, 'Nome ENS inválido (ex.: ana.eth)')
export type EnsName = z.infer<typeof EnsName>

export const Username = z
  .string()
  .trim()
  .regex(/^[a-z0-9_]{3,20}$/i, 'Use de 3 a 20 letras, números ou _')
export type Username = z.infer<typeof Username>

export const ReferralCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{4,32}$/, 'Código de indicação inválido')
export type ReferralCode = z.infer<typeof ReferralCode>

/**
 * Campos do formulário do colecionador (Pagamento e Carteiras).
 * Código de indicação e nome ENS são obrigatórios, como no layout.
 */
export const CollectorFormFields = z.object({
  displayName: PersonName,
  username: Username,
  network: Network,
  profileName: PersonName,
  address: WalletAddress,
  /** ENS ou endereço de uma carteira secundária. Opcional. */
  secondaryWallet: z.union([EnsName, WalletAddress]).optional(),
  walletType: WalletType,
  referralCode: ReferralCode,
  email: Email,
  ensName: EnsName,
  note: z.string().trim().max(280, 'A observação deve ter no máximo 280 caracteres').optional(),
})
export type CollectorFormFields = z.infer<typeof CollectorFormFields>

export const WalletInput = CollectorFormFields.extend({
  /** Apelido da carteira. */
  nickname: z.string().trim().min(1, 'Informe um apelido para a carteira').max(40),
  role: WalletRole,
})
export type WalletInput = z.infer<typeof WalletInput>

export const Wallet = WalletInput.extend({
  id: Id,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
})
export type Wallet = z.infer<typeof Wallet>

export const WalletList = z.object({ items: z.array(Wallet) })
export type WalletList = z.infer<typeof WalletList>
