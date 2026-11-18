import { z } from 'zod'
import { Email, Password, PersonName } from './auth'
import { Id, IsoDateTime, Version } from './common'

/** URL http(s) ou data URL de imagem (upload de avatar simulado). */
export const AvatarUrl = z.union([
  z.url({ protocol: /^https?$/ }),
  z.string().regex(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/, 'Imagem inválida'),
])
export type AvatarUrl = z.infer<typeof AvatarUrl>

export const Profile = z.object({
  id: Id,
  name: PersonName,
  email: Email,
  bio: z.string().max(280),
  avatarUrl: AvatarUrl.nullable(),
  updatedAt: IsoDateTime,
  version: Version,
})
export type Profile = z.infer<typeof Profile>

export const UpdateProfileInput = z.object({
  name: PersonName,
  email: Email,
  bio: z.string().trim().max(280, 'A bio deve ter no máximo 280 caracteres'),
  /** null remove o avatar. */
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
