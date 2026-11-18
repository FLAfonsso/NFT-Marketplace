import { redirect, type ParsedLocation } from '@tanstack/react-router'
import { z } from 'zod'
import { safeRedirect } from './redirect'
import type { sessionStore } from './session'

interface GuardContext {
  session: typeof sessionStore
}

/** Search de /login e /signup: rota para onde voltar depois de entrar. */
export const authSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
})

/** beforeLoad das rotas privadas. Espera a recuperação da sessão antes de decidir. */
export async function requireSession({
  context,
  location,
}: {
  context: GuardContext
  location: ParsedLocation
}) {
  const state = await context.session.whenReady()
  if (state.status !== 'authenticated') {
    throw redirect({ to: '/login', search: { redirect: location.href } })
  }
}

/** beforeLoad de /login e /signup: com sessão, volta para a rota original. */
export async function redirectIfAuthenticated({
  context,
  search,
}: {
  context: GuardContext
  search: z.infer<typeof authSearchSchema>
}) {
  const state = await context.session.whenReady()
  if (state.status === 'authenticated') {
    throw redirect({ href: safeRedirect(search.redirect), replace: true })
  }
}
