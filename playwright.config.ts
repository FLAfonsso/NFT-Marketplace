import { defineConfig } from '@playwright/test'

// Porta própria dos testes: o `pnpm dev` continua na 5173 sem interferir.
const PORT = 5199
// E2E_BASE_URL aponta os testes para um servidor já no ar (ex.: `pnpm preview`); sem ela, sobe o Vite.
const EXTERNAL_URL = process.env.E2E_BASE_URL
const BASE_URL = EXTERNAL_URL ?? `http://localhost:${PORT}`
const isCI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  // Cada teste tem seu próprio estado (ver e2e/fixtures.ts), então podem rodar em paralelo.
  fullyParallel: true,
  // O dev server com mocks (MSW) em um só processo satura com muitos navegadores: limita a 4.
  workers: 4,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'pt-BR',
  },
  expect: {
    toHaveScreenshot: {
      // Tolerância curta: só absorve o serrilhado do anti-aliasing, nunca uma mudança de layout.
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },
  // Baselines visuais versionadas, separadas por projeto. Sem sufixo de plataforma: o nome do
  // arquivo é o mesmo no Windows, no macOS e no Linux (ver README, "Testes").
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}',
  projects: [
    {
      name: 'desktop',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: EXTERNAL_URL
    ? undefined
    : {
        command: `pnpm exec vite --port ${PORT} --strictPort`,
        url: BASE_URL,
        env: { VITE_ENABLE_MOCKS: 'true' },
        // Nunca reaproveita servidor: se a porta estiver ocupada, o Vite falha (strictPort).
        reuseExistingServer: false,
        timeout: 120_000,
      },
})
