import { z } from 'zod'
import { Email, Password, PersonName } from '@/contracts'

/**
 * Os formulários reaproveitam os schemas de campo de src/contracts. Só trocam a mensagem do
 * campo vazio ("Informe...") e acrescentam a confirmação de senha, que não vai para a API.
 */
const requiredEmail = z.string().trim().min(1, 'Informe o e-mail').pipe(Email)
const requiredPassword = z.string().min(1, 'Informe a senha').pipe(Password)

export const loginFormSchema = z.object({
  email: requiredEmail,
  password: requiredPassword,
})
export type LoginFormInput = z.input<typeof loginFormSchema>
export type LoginFormOutput = z.output<typeof loginFormSchema>

export const signupFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Informe o nome de usuário').pipe(PersonName),
    email: requiredEmail,
    password: requiredPassword,
    confirmPassword: z.string().min(1, 'Confirme a senha'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem',
  })
export type SignupFormInput = z.input<typeof signupFormSchema>
export type SignupFormOutput = z.output<typeof signupFormSchema>
