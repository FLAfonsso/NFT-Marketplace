import { createFileRoute } from '@tanstack/react-router'
import { requireSession } from '@/features/auth/routeGuards'

/** Layout sem caminho das rotas privadas: sem sessão, vai para /login?redirect=<rota>. */
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: requireSession,
})
