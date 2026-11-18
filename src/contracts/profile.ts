import { z } from 'zod'
import { Email, Password, PersonName } from './auth'
import { Id, IsoDateTime, Version } from './common'
import { EnsName, Username } from './wallet'

/** URL http(s) ou data URL de imagem (upload de avatar simulado). */
export const AvatarUrl = z.union([
  z.url({ protocol: /^https?$/ }),
  z.string().regex(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/, 'Imagem inválida'),
])
export type AvatarUrl = z.infer<typeof AvatarUrl>

export const Profile = z.object({
  id: Id,
  displayName: PersonName,
  username: Username,
  email: Email,
  ensName: EnsName.nullable(),
  /** Apelido da carteira principal (null se ainda não há carteira). */
  walletNickname: z.string().nullable(),
  avatarUrl: AvatarUrl.nullable(),
  updatedAt: IsoDateTime,
  version: Version,
})
export type Profile = z.infer<typeof Profile>

export const UpdateProfileInput = z.object({
  displayName: PersonName,
  username: Username,
  email: Email,
  /** null remove o nome ENS. */
  ensName: EnsName.nullable(),
  /** Renomeia a carteira principal. Exige que ela exista. */
  walletNickname: z.string().trim().min(1, 'Informe um apelido').max(40).nullable(),
  /** Ausente mantém o avatar; null remove. */
  avatarUrl: AvatarUrl.nullable().optional(),
})
export type UpdateProfileInput = z.infer<typeof UpdateProfileInput>

export const ChangePasswordInput = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: Password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: 'A nova senha deve ser diferente da atual',
    path: ['newPassword'],
  })
export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>
