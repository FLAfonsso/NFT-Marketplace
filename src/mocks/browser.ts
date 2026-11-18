import { setupWorker } from 'msw/browser'
import { mockControl, type MockControl } from './control'
import { handlers } from './handlers'

declare global {
  interface Window {
    __mocks?: MockControl
  }
}

export const worker = setupWorker(...handlers)

/** Liga o MSW quando VITE_ENABLE_MOCKS=true. Deve terminar antes de renderizar o app. */
export async function enableMocking() {
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'true') return

  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    // Só a API é simulada; assets e outras origens seguem para a rede sem aviso.
    onUnhandledFrame: 'bypass',
    quiet: import.meta.env.PROD,
  })
  window.__mocks = mockControl
}
