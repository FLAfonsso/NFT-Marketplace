import type { UseFormReturn } from 'react-hook-form'
import { NETWORKS, WALLET_TYPES } from '@/contracts'
import { cn } from '@/lib/utils'
import { NETWORK_LABELS } from '../labels'
import type { CheckoutFormOutput, CheckoutFormValues } from '../schema'
import { SelectField, TextareaField, TextField } from '@/components/FormField'

const networkOptions = NETWORKS.map((n) => ({ value: n, label: NETWORK_LABELS[n] }))
const walletTypeOptions = WALLET_TYPES.map((t) => ({ value: t, label: t }))

/**
 * Campos do "Perfil do colecionador" na ordem do layout (duas colunas no desktop).
 * O envio fica com a página: "Confirmar compra" valida e abre a revisão.
 */
export function CollectorForm({
  form,
  disabled,
  className,
}: {
  form: UseFormReturn<CheckoutFormValues, unknown, CheckoutFormOutput>
  disabled: boolean
  className?: string
}) {
  const {
    register,
    formState: { errors },
  } = form

  return (
    <fieldset
      disabled={disabled}
      className={cn('grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2', className)}
    >
      <legend className="sr-only">Perfil do colecionador</legend>
      <TextField
        {...register('displayName')}
        label="Nome de exibição"
        required
        autoComplete="name"
        error={errors.displayName?.message}
      />
      <TextField
        {...register('username')}
        label="Nome de usuário"
        required
        autoComplete="username"
        spellCheck={false}
        error={errors.username?.message}
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
        className="md:pt-[1.625rem]"
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
      <TextField
        {...register('ensLabel')}
        label="Nome ENS"
        required
        placeholder="seu-nome"
        autoComplete="off"
        spellCheck={false}
        error={errors.ensLabel?.message}
        suffix={
          <span className="grid h-10 shrink-0 place-items-center rounded-sm border border-border px-3 text-sm">
            .eth
          </span>
        }
      />
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm md:col-span-2">
        <input
          type="checkbox"
          {...register('useOtherWallet')}
          className="size-4 cursor-pointer appearance-none rounded-full border-2 border-primary outline-none checked:border-[5px] focus-visible:ring-2 focus-visible:ring-ring"
        />
        Usar outra carteira?
      </label>
      <TextareaField
        {...register('note')}
        label="Observação do colecionador (opcional)"
        maxLength={280}
        className="md:col-span-1"
        error={errors.note?.message}
      />
    </fieldset>
  )
}
