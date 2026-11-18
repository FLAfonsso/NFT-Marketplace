import type { UseFormReturn } from 'react-hook-form'
import { EnsField } from '@/components/EnsField'
import { SelectField, TextField } from '@/components/FormField'
import { NETWORKS, WALLET_TYPES } from '@/contracts'
import { NETWORK_LABELS } from '@/features/checkout/labels'
import { cn } from '@/lib/utils'
import type { WalletFormOutput, WalletFormValues } from '../schema'

const networkOptions = NETWORKS.map((n) => ({ value: n, label: NETWORK_LABELS[n] }))
const walletTypeOptions = WALLET_TYPES.map((t) => ({ value: t, label: t }))

export const WALLET_GRID = 'grid grid-cols-1 gap-x-7 gap-y-6 lg:grid-cols-2 lg:gap-y-8'

export type WalletForm = UseFormReturn<WalletFormValues, unknown, WalletFormOutput>

/** Campos da carteira, na ordem do layout (duas colunas no desktop; uma no mobile e no tablet). */
export function WalletFields({
  form,
  disabled,
  className,
}: {
  form: WalletForm
  disabled: boolean
  className?: string
}) {
  const {
    register,
    formState: { errors },
  } = form
  return (
    <fieldset disabled={disabled} className={cn(WALLET_GRID, className)}>
      <legend className="sr-only">Dados da carteira</legend>
      <TextField
        {...register('displayName')}
        label="Nome de exibição"
        required
        autoComplete="name"
        error={errors.displayName?.message}
      />
      <TextField
        {...register('nickname')}
        label="Apelido da carteira"
        required
        autoComplete="off"
        error={errors.nickname?.message}
      />
      <SelectField
        {...register('network')}
        label="Rede"
        required
        placeholder="Selecione uma rede"
        options={networkOptions}
        error={errors.network?.message}
      />
      <TextField
        {...register('profileName')}
        label="Nome do perfil"
        required
        error={errors.profileName?.message}
      />
      <TextField
        {...register('address')}
        label="Endereço da carteira"
        required
        placeholder="Endereço 0x da carteira"
        autoComplete="off"
        spellCheck={false}
        error={errors.address?.message}
      />
      <TextField
        {...register('secondaryWallet')}
        label="ENS ou carteira secundária (opcional)"
        placeholder="ENS ou carteira secundária (opcional)"
        className="lg:pt-[1.625rem]"
        hideLabel
        autoComplete="off"
        spellCheck={false}
        error={errors.secondaryWallet?.message}
      />
      <SelectField
        {...register('walletType')}
        label="Tipo de carteira"
        required
        placeholder="Selecione uma carteira"
        options={walletTypeOptions}
        error={errors.walletType?.message}
      />
      <TextField
        {...register('referralCode')}
        label="Código de indicação"
        required
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        error={errors.referralCode?.message}
      />
      <TextField
        {...register('email')}
        label="E-mail"
        type="email"
        required
        autoComplete="email"
        error={errors.email?.message}
      />
      <EnsField {...register('ensLabel')} error={errors.ensLabel?.message} />
    </fieldset>
  )
}
