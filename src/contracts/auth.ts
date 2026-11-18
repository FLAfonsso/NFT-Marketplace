import { z } from 'zod'
import { Id, IsoDateTime } from './common'

export const Email = z.email('E-mail inválido').trim().toLowerCase()
export type Email = z.infer<typeof Email>

export const Password = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres')
  .max(128, 'A senha deve ter no máximo 128 caracteres')
export type Password = z.infer<typeof Password>

export const PersonName = z
  .string()
  .trim()
  .min(2, 'Informe pelo menos 2 caracteres')
  .max(80, 'Informe no máximo 80 caracteres')
export type PersonName = z.infer<typeof PersonName>

export const User = z.object({
  id: Id,
  name: PersonName,
  email: Email,
  avatarUrl: z.string().nullable(),
})
export type User = z.infer<typeof User>

export const RegisterInput = z.object({
  name: PersonName,
  email: Email,
  password: Password,
})
export type RegisterInput = z.infer<typeof RegisterInput>

export const LoginInput = z.object({
  email: Email,
  password: z.string().min(1, 'Informe a senha'),
})
export type LoginInput = z.infer<typeof LoginInput>

export const Session = z.object({
  user: User,
  token: z.string().min(1),
  expiresAt: IsoDateTime,
})
export type Session = z.infer<typeof Session>
