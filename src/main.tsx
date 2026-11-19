import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import './index.css'
import { AuthProvider } from '@/features/auth'
import { queryClient } from '@/lib/queryClient'
import { router } from './router'

/** Mostra a falha dos mocks na tela, em vez de seguir sem eles em silêncio. */
function showMockFailure(error: unknown) {
  const reason = error instanceof Error ? error.message : String(error)
  console.error('[mocks] falha ao iniciar o MSW; o app não será renderizado.', error)
  const box = document.createElement('div')
  box.setAttribute('role', 'alert')
  box.style.cssText = 'font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:1rem'
  const title = document.createElement('h1')
  title.textContent = 'Não foi possível iniciar a API simulada'
  const detail = document.createElement('p')
  detail.textContent = `Motivo: ${reason}. Recarregue a página; se persistir, verifique se o service worker está disponível (HTTPS e /mockServiceWorker.js).`
  box.append(title, detail)
  document.getElementById('root')!.replaceChildren(box)
}

/** Carrega o MSW só quando ligado por configuração, e antes do primeiro request do app. */
async function prepare() {
  const flag = import.meta.env.VITE_ENABLE_MOCKS
  if (flag !== 'true') {
    // Um valor definido mas diferente de "true" (ex.: aspas ou espaço na Vercel) sobrepõe o .env.production.
    console.warn(`[mocks] desligados: VITE_ENABLE_MOCKS=${JSON.stringify(flag)} (esperado exatamente "true").`)
    return true
  }
  try {
    const { enableMocking } = await import('./mocks/browser')
    await enableMocking()
    return true
  } catch (error) {
    showMockFailure(error)
    return false
  }
}

prepare().then((ok) => {
  if (!ok) return
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
