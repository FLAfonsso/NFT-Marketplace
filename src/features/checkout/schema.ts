import { z } from 'zod'
import {
  Email,
  EnsName,
  Network,
  PersonName,
  ReferralCode,
  Username,
  WalletAddress,
  WalletType,
  type CollectorFormFields,
} from '@/contracts'

/**
 * Formulário "Perfil do colecionador". Reaproveita os schemas de campo de src/contracts e só
 * troca a mensagem do campo vazio. O nome ENS é digitado sem o sufixo ".eth" (o layout mostra o
 * sufixo ao lado do campo) e volta completo na saída.
 */
const required = (message: string) => z.string().trim().min(1, message)

const ENS_LABEL = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/i
const stripEth = (value: string) => value.trim().replace(/\.eth$/i, '')

const optionalText = (schema: z.ZodType<string, string>) =>
  z
    .string()
    .trim()
    .transform((value) => (value === '' ? undefined : value))
    .pipe(schema.optional())

export const checkoutFormSchema = z
  .object({
    /** Carteira cadastrada escolhida (Reserva, Principal...). */
    walletId: required('Selecione uma carteira cadastrada'),
    displayName: required('Informe o nome de exibição').pipe(PersonName),
    username: required('Informe o nome de usuário').pipe(Username),
    network: required('Selecione uma rede').pipe(Network),
    profileName: required('Informe o nome do perfil').pipe(PersonName),
    address: required('Informe o endereço da carteira').pipe(WalletAddress),
    secondaryWallet: optionalText(
      z.union([EnsName, WalletAddress], {
        error: 'Use um nome ENS (ex.: ana.eth) ou um endereço 0x com 40 hexadecimais',
      }),
    ),
    walletType: required('Selecione o tipo de carteira').pipe(WalletType),
    email: required('Informe o e-mail').pipe(Email),
    referralCode: required('Informe o código de indicação').pipe(ReferralCode),
    ensLabel: required('Informe o nome ENS')
      .transform(stripEth)
      .pipe(
        z
          .string()
          .regex(ENS_LABEL, 'Use letras, números ou hífen (ex.: ana)')
          .transform((label) => `${label.toLowerCase()}.eth`),
      ),
    /** "Usar outra carteira?": exige o ENS ou endereço da carteira secundária. */
    useOtherWallet: z.boolean(),
    note: optionalText(z.string().max(280, 'A observação deve ter no máximo 280 caracteres')),
  })
  .refine((value) => !value.useOtherWallet || value.secondaryWallet !== undefined, {
    path: ['secondaryWallet'],
    message: 'Informe o ENS ou o endereço da outra carteira',
    when: (payload) => payload.issues.every((issue) => issue.path?.[0] !== 'secondaryWallet'),
  })

export type CheckoutFormValues = z.input<typeof checkoutFormSchema>
export type CheckoutFormOutput = z.output<typeof checkoutFormSchema>

export const CHECKOUT_FIELDS = [
  'walletId',
  'displayName',
  'username',
  'network',
  'profileName',
  'address',
  'secondaryWallet',
  'walletType',
  'email',
  'referralCode',
  'ensLabel',
  'useOtherWallet',
  'note',
] as const satisfies readonly (keyof CheckoutFormValues)[]

export type CheckoutField = (typeof CHECKOUT_FIELDS)[number]

export const EMPTY_FORM: CheckoutFormValues = {
  walletId: '',
  displayName: '',
  username: '',
  network: '',
  profileName: '',
  address: '',
  secondaryWallet: '',
  walletType: '',
  email: '',
  referralCode: '',
  ensLabel: '',
  useOtherWallet: false,
  note: '',
}

/** Campos do pedido (CreateOrderInput) a partir da saída do formulário. */
export function toCollectorFields(output: CheckoutFormOutput): CollectorFormFields {
  return {
    displayName: output.displayName,
    username: output.username,
    network: output.network,
    profileName: output.profileName,
    address: output.address,
    ...(output.secondaryWallet ? { secondaryWallet: output.secondaryWallet } : {}),
    walletType: output.walletType,
    referralCode: output.referralCode,
    email: output.email,
    ensName: output.ensLabel,
    ...(output.note ? { note: output.note } : {}),
  }
}

/** Campo do formulário para um caminho de fieldErrors da API (ensName vira ensLabel). */
export function fieldForApiPath(path: string): CheckoutField | null {
  if (path === 'ensName') return 'ensLabel'
  return (CHECKOUT_FIELDS as readonly string[]).includes(path) ? (path as CheckoutField) : null
}
