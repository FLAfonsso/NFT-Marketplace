import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2Icon } from 'lucide-react'
import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { EnsField } from '@/components/EnsField'
import { PasswordField, TextField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { ChangePasswordInput, type Profile } from '@/contracts'
import { FormAlertBox, applyServerErrors, useUnsavedChanges, type FormAlertState } from '@/features/account'
import { profileApi } from '../profileApi'
import {
  EMPTY_PASSWORD,
  makeProfileFormSchema,
  PROFILE_FIELD_MAP,
  toFormValues,
  toUpdateInput,
  type PasswordFormValues,
  type ProfileFormOutput,
  type ProfileFormValues,
} from '../schema'
import { useUpdateProfile } from '../useProfile'
import { AvatarField } from './AvatarField'

export const PROFILE_GRID = 'grid grid-cols-1 gap-x-7 gap-y-6 lg:grid-cols-2 lg:gap-y-8'

const PASSWORD_FIELD_MAP = {
  currentPassword: 'currentPassword',
  newPassword: 'newPassword',
  confirmPassword: 'confirmPassword',
} as const

/**
 * Dados do perfil + alteração de senha, com um único "Salvar". Cada parte tem a própria
 * validação e os próprios erros da API (nos campos certos); a senha nunca passa por mutation,
 * cache ou storage e some com a tela.
 */
export function ProfileForm({ userId, profile }: { userId: string; profile: Profile }) {
  const hasWallet = profile.walletNickname !== null
  const schema = useMemo(() => makeProfileFormSchema(hasWallet), [hasWallet])
  const form = useForm<ProfileFormValues, unknown, ProfileFormOutput>({
    resolver: zodResolver(schema),
    // Segue o servidor (ex.: apelido alterado em Carteiras) sem apagar o que o usuário digitou.
    values: toFormValues(profile),
    resetOptions: { keepDirtyValues: true },
    mode: 'onTouched',
  })
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(ChangePasswordInput),
    defaultValues: EMPTY_PASSWORD,
    mode: 'onTouched',
  })
  const update = useUpdateProfile(userId)
  const [alert, setAlert] = useState<FormAlertState | null>(null)
  const [passwordPending, setPasswordPending] = useState(false)
  const inFlight = useRef(false)

  const passwordValues = useWatch({ control: passwordForm.control })
  const passwordTouched = Object.values(passwordValues).some(Boolean)
  const dirty = form.formState.isDirty
  const busy = update.isPending || passwordPending
  useUnsavedChanges(dirty || passwordTouched)

  const { errors } = form.formState
  const passwordErrors = passwordForm.formState.errors

  const save = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setAlert(null)
    try {
      // Valida as duas partes antes de enviar qualquer uma.
      const valid: { profile?: ReturnType<typeof toUpdateInput>; password?: ChangePasswordInput } = {}
      if (dirty) {
        await form.handleSubmit((values) => {
          valid.profile = toUpdateInput(values, hasWallet)
        })()
        if (!valid.profile) return
      }
      if (passwordTouched) {
        await passwordForm.handleSubmit((values) => {
          valid.password = values
        })()
        if (!valid.password) return
      }
      const { profile: profileInput, password: passwordInput } = valid

      if (profileInput) {
        try {
          const saved = await update.mutateAsync(profileInput)
          form.reset(toFormValues(saved))
          toast.success('Perfil atualizado com sucesso')
        } catch (error) {
          setAlert(applyServerErrors(error, form.setError, PROFILE_FIELD_MAP))
          return
        }
      }
      if (passwordInput) {
        setPasswordPending(true)
        try {
          await profileApi.changePassword(passwordInput)
          passwordForm.reset(EMPTY_PASSWORD)
          toast.success('Senha alterada com sucesso')
        } catch (error) {
          setAlert(applyServerErrors(error, passwordForm.setError, PASSWORD_FIELD_MAP))
        } finally {
          setPasswordPending(false)
        }
      }
    } finally {
      inFlight.current = false
    }
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void save()
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={busy} className="flex flex-col gap-8">
      <FormAlertBox alert={alert} busy={busy} onRetry={() => void save()} />

      <fieldset disabled={busy} className={PROFILE_GRID}>
        <legend className="sr-only">Dados do perfil</legend>
        <TextField
          {...form.register('displayName')}
          label="Nome de exibição"
          required
          autoComplete="name"
          error={errors.displayName?.message}
        />
        <TextField
          {...form.register('username')}
          label="Nome de usuário"
          required
          autoComplete="username"
          spellCheck={false}
          error={errors.username?.message}
        />
        <TextField
          {...form.register('email')}
          label="E-mail"
          type="email"
          required
          autoComplete="email"
          error={errors.email?.message}
        />
        <EnsField {...form.register('ensLabel')} error={errors.ensLabel?.message} />
        <TextField
          {...form.register('walletNickname')}
          label="Apelido da carteira"
          required={hasWallet}
          disabled={!hasWallet}
          autoComplete="off"
          hint={hasWallet ? undefined : 'Cadastre uma carteira principal em Carteiras para definir o apelido.'}
          error={errors.walletNickname?.message}
        />
        <AvatarField userId={userId} name={profile.displayName} avatarUrl={profile.avatarUrl} />
      </fieldset>

      <fieldset disabled={busy} className="flex flex-col gap-6 lg:w-[calc(50%-0.875rem)]">
        <legend className="mb-6 text-base font-bold">Alterar senha</legend>
        <PasswordField
          {...passwordForm.register('currentPassword')}
          label="Senha atual"
          autoComplete="current-password"
          error={passwordErrors.currentPassword?.message}
        />
        <PasswordField
          {...passwordForm.register('newPassword')}
          label="Nova senha"
          autoComplete="new-password"
          hint="Mínimo de 8 caracteres."
          error={passwordErrors.newPassword?.message}
        />
        <PasswordField
          {...passwordForm.register('confirmPassword')}
          label="Confirmar nova senha"
          autoComplete="new-password"
          error={passwordErrors.confirmPassword?.message}
        />
      </fieldset>

      <Button
        type="submit"
        disabled={busy || !(dirty || passwordTouched)}
        aria-busy={busy}
        className="h-10 w-full rounded-sm px-8 font-bold uppercase lg:w-auto lg:self-start"
      >
        {busy && <Loader2Icon className="animate-spin" aria-hidden="true" />}
        Salvar
      </Button>
    </form>
  )
}
