import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { notifyUnavailable } from '@/lib/unavailable'
import { useAuth } from '../context'
import { applyApiError } from '../forms/applyApiError'
import { loginFormSchema, type LoginFormInput, type LoginFormOutput } from '../forms/schemas'
import { AuthField } from './AuthField'
import { FormAlertBanner } from './FormAlertBanner'
import { SocialButtons } from './SocialButtons'
import { SubmitButton } from './SubmitButton'
import { useAuthSubmit } from './useAuthSubmit'

export function LoginForm({ redirect }: { redirect: string | undefined }) {
  const { login } = useAuth()
  const { register, handleSubmit, setError, formState } = useForm<
    LoginFormInput,
    unknown,
    LoginFormOutput
  >({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: '', password: '' },
  })
  const { errors, isSubmitting } = formState

  const { alert, run } = useAuthSubmit(redirect, (error) =>
    applyApiError(error, setError, ['email', 'password']),
  )

  const onSubmit = handleSubmit((values) => run(() => login(values)))

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlertBanner alert={alert} busy={isSubmitting} onRetry={() => void onSubmit()} />
        <AuthField
          {...register('email')}
          label="E-mail"
          type="email"
          autoComplete="email"
          placeholder="contato@email.com"
          error={errors.email?.message}
          autoFocus
        />
        <div className="flex flex-col gap-2">
          <AuthField
            {...register('password')}
            label="Senha"
            type="password"
            autoComplete="current-password"
            revealable
            error={errors.password?.message}
          />
          <button
            type="button"
            aria-disabled="true"
            onClick={notifyUnavailable}
            className="self-end text-xs text-primary underline-offset-4 outline-none hover:underline focus-visible:underline aria-disabled:cursor-not-allowed"
          >
            Esqueceu a senha?
          </button>
        </div>
        <SubmitButton pending={isSubmitting}>Entrar</SubmitButton>
      </form>
      <SocialButtons />
    </div>
  )
}
