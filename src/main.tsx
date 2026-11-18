import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import './index.css'
import { AuthProvider } from '@/features/auth'
import { queryClient } from '@/lib/queryClient'
import { router } from './router'

/** Carrega o MSW só quando ligado por configuração, e antes do primeiro request do app. */
async function prepare() {
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'true') return
  const { enableMocking } = await import('./mocks/browser')
  await enableMocking()
}

prepare().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
})
