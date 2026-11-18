import { z } from 'zod'
import {
  Email,
  EnsName,
  Network,
  PersonName,
  ReferralCode,
  WalletAddress,
  WalletType,
  type Wallet,
  type WalletInput,
  type WalletRole,
} from '@/contracts'
import { ensLabel, ensLabelOf, optionalText, required } from '@/lib/formSchemas'

/**
 * Formulário de carteira (principal e secundária). Reaproveita os schemas de campo de
 * src/contracts e troca só as mensagens do campo vazio. O nome ENS é digitado sem ".eth".
 */
export const walletFormSchema = z.object({
  displayName: required('Informe o nome de exibição').pipe(PersonName),
  nickname: required('Informe um apelido para a carteira').pipe(
    z.string().max(40, 'Use no máximo 40 caracteres'),
  ),
  network: required('Selecione uma rede').pipe(Network),
  profileName: required('Informe o nome do perfil').pipe(PersonName),
  address: required('Informe o endereço da carteira').pipe(WalletAddress),
  secondaryWallet: optionalText(
    z.union([EnsName, WalletAddress], {
      error: 'Use um nome ENS (ex.: ana.eth) ou um endereço 0x com 40 hexadecimais',
    }),
  ),
  walletType: required('Selecione o tipo de carteira').pipe(WalletType),
  referralCode: required('Informe o código de indicação').pipe(ReferralCode),
  email: required('Informe o e-mail').pipe(Email),
  ensLabel: ensLabel(),
})

export type WalletFormValues = z.input<typeof walletFormSchema>
export type WalletFormOutput = z.output<typeof walletFormSchema>

export const EMPTY_WALLET_FORM: WalletFormValues = {
  displayName: '',
  nickname: '',
  network: '',
  profileName: '',
  address: '',
  secondaryWallet: '',
  walletType: '',
  referralCode: '',
  email: '',
  ensLabel: '',
}

/** Caminho do erro da API → campo do formulário (ensName vira ensLabel). */
export const WALLET_FIELD_MAP = {
  displayName: 'displayName',
  nickname: 'nickname',
  network: 'network',
  profileName: 'profileName',
  address: 'address',
  secondaryWallet: 'secondaryWallet',
  walletType: 'walletType',
  referralCode: 'referralCode',
  email: 'email',
  ensName: 'ensLabel',
} as const

export const toFormValues = (wallet: Wallet): WalletFormValues => ({
  displayName: wallet.displayName,
  nickname: wallet.nickname,
  network: wallet.network,
  profileName: wallet.profileName,
  address: wallet.address,
  secondaryWallet: wallet.secondaryWallet ?? '',
  walletType: wallet.walletType,
  referralCode: wallet.referralCode,
  email: wallet.email,
  ensLabel: ensLabelOf(wallet.ensName),
})

/** Corpo de POST/PATCH /wallets. Na edição, a observação da carteira (se houver) é preservada. */
export const toWalletInput = (
  output: WalletFormOutput,
  role: WalletRole,
  /** Nome de usuário do perfil (o contrato de carteira o exige; o formulário não o mostra). */
  username: string,
  existing?: Wallet,
): WalletInput => ({
  displayName: output.displayName,
  username: existing?.username ?? username,
  nickname: output.nickname,
  network: output.network,
  profileName: output.profileName,
  address: output.address,
  ...(output.secondaryWallet ? { secondaryWallet: output.secondaryWallet } : {}),
  walletType: output.walletType,
  referralCode: output.referralCode,
  email: output.email,
  ensName: output.ensLabel,
  ...(existing?.note ? { note: existing.note } : {}),
  role,
})
