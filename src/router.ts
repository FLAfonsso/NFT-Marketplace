import { createRouter } from '@tanstack/react-router'
import { NotFoundPage, RouteErrorPage } from '@/components/RouteStatus'
import { sessionStore } from '@/features/auth'
import { setUnauthorizedHandler } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import { parseSearch, stringifySearch } from '@/lib/searchParams'
import { routeTree } from './routeTree.gen'

export const router = createRouter({
  routeTree,
  context: { queryClient, session: sessionStore },
  parseSearch,
  stringifySearch,
  defaultPreload: 'intent',
  // O Query controla a frescura dos dados; o Router não guarda cópia própria.
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  defaultNotFoundComponent: NotFoundPage,
  defaultErrorComponent: RouteErrorPage,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const AUTH_PATHS = new Set(['/login', '/signup'])

// 401 durante o uso: encerra a sessão (cache e socket incluídos) e manda para o login,
// guardando a rota atual para voltar depois.
setUnauthorizedHandler(() => {
  sessionStore.expire()
  const { href, pathname } = router.state.location
  if (AUTH_PATHS.has(pathname)) return
  void router.navigate({ to: '/login', search: { redirect: href }, replace: true })
})

// Entrou, saiu ou trocou de usuário: os guards (beforeLoad) rodam de novo na rota atual.
let lastIdentity = identity()
sessionStore.subscribe(() => {
  const next = identity()
  if (next === lastIdentity) return
  lastIdentity = next
  void router.invalidate()
})

function identity() {
  const state = sessionStore.getState()
  return state.status === 'authenticated' ? `user:${state.user.id}` : state.status
}
