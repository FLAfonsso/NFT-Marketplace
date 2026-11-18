import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext } from '@tanstack/react-router'
import { Shell } from '@/components/layout/Shell'
import { NotFoundPage, RouteErrorPage } from '@/components/RouteStatus'
import { Toaster } from '@/components/ui/sonner'
import type { sessionStore } from '@/features/auth'
import { ConnectionIndicator, useRealtimeSync } from '@/features/realtime'

export interface RouterContext {
  queryClient: QueryClient
  session: typeof sessionStore
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
  errorComponent: RouteErrorPage,
})

function RootLayout() {
  // Tempo real da sessão atual (ou de visitante): listeners, versões e reconciliação.
  useRealtimeSync()
  return (
    <>
      <Shell />
      <ConnectionIndicator />
      <Toaster />
    </>
  )
}
