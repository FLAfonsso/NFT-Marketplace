import { z } from 'zod'
import { Email, PersonName, Username, type Profile, type UpdateProfileInput } from '@/contracts'
import { ensLabel, ensLabelOf, required } from '@/lib/formSchemas'

/**
 * Formulário "Perfil do colecionador". Reaproveita os schemas de campo de src/contracts. O nome
 * ENS é digitado sem ".eth" (sufixo fixo ao lado). Sem carteira principal não há apelido para
 * editar: o campo fica desabilitado e vai como null.
 */
export const makeProfileFormSchema = (hasWallet: boolean) =>
  z.object({
    displayName: required('Informe o nome de exibição').pipe(PersonName),
    username: required('Informe o nome de usuário').pipe(Username),
    email: required('Informe o e-mail').pipe(Email),
    ensLabel: ensLabel(),
    walletNickname: hasWallet
      ? required('Informe o apelido da carteira').pipe(
          z.string().max(40, 'Use no máximo 40 caracteres'),
        )
      : z.string(),
  })

export type ProfileFormValues = z.input<ReturnType<typeof makeProfileFormSchema>>
export type ProfileFormOutput = z.output<ReturnType<typeof makeProfileFormSchema>>

export const PROFILE_FIELD_MAP = {
  displayName: 'displayName',
  username: 'username',
  email: 'email',
  ensName: 'ensLabel',
  walletNickname: 'walletNickname',
} as const

export const toFormValues = (profile: Profile): ProfileFormValues => ({
  displayName: profile.displayName,
  username: profile.username,
  email: profile.email,
  ensLabel: ensLabelOf(profile.ensName),
  walletNickname: profile.walletNickname ?? '',
})

export const toUpdateInput = (output: ProfileFormOutput, hasWallet: boolean): UpdateProfileInput => ({
  displayName: output.displayName,
  username: output.username,
  email: output.email,
  ensName: output.ensLabel,
  walletNickname: hasWallet ? output.walletNickname : null,
})

/** Troca de senha: o contrato já traz as mensagens em português. */
export type PasswordFormValues = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export const EMPTY_PASSWORD: PasswordFormValues = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
}
