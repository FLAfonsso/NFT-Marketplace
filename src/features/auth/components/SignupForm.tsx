import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useAuth } from '../context'
import { applyApiError } from '../forms/applyApiError'
import { signupFormSchema, type SignupFormInput, type SignupFormOutput } from '../forms/schemas'
import { AuthField } from './AuthField'
import { FormAlertBanner } from './FormAlertBanner'
import { SocialButtons } from './SocialButtons'
import { SubmitButton } from './SubmitButton'
import { useAuthSubmit } from './useAuthSubmit'

export function SignupForm({
  redirect,
  submitLabel,
}: {
  redirect: string | undefined
  submitLabel: string
}) {
  const { register: registerAccount } = useAuth()
  const { register, handleSubmit, setError, formState } = useForm<
    SignupFormInput,
    unknown,
    SignupFormOutput
  >({
    resolver: zodResolver(signupFormSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })
  const { errors, isSubmitting } = formState

  const { alert, run } = useAuthSubmit(redirect, (error) =>
    applyApiError(error, setError, ['name', 'email', 'password'], 'email'),
  )

  const onSubmit = handleSubmit(({ name, email, password }) =>
    run(() => registerAccount({ name, email, password })),
  )

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlertBanner alert={alert} busy={isSubmitting} onRetry={() => void onSubmit()} />
        <AuthField
          {...register('name')}
          label="Nome de usuário"
          autoComplete="username"
          error={errors.name?.message}
          autoFocus
        />
        <AuthField
          {...register('email')}
          label="E-mail"
          type="email"
          autoComplete="email"
          placeholder="Digite seu e-mail"
          error={errors.email?.message}
        />
        <AuthField
          {...register('password')}
          label="Senha"
          type="password"
          autoComplete="new-password"
          revealable
          error={errors.password?.message}
        />
        <AuthField
          {...register('confirmPassword')}
          label="Confirmar senha"
          type="password"
          autoComplete="new-password"
          revealable
          error={errors.confirmPassword?.message}
        />
        <SubmitButton pending={isSubmitting}>{submitLabel}</SubmitButton>
      </form>
      <SocialButtons />
    </div>
  )
}
