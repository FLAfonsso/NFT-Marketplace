import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

/** Carrega o MSW só quando ligado por configuração, e antes do primeiro request do app. */
async function prepare() {
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'true') return
  const { enableMocking } = await import('./mocks/browser')
  await enableMocking()
}

prepare().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
