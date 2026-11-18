import { defineConfig } from '@playwright/test'

const PORT = 5173
const BASE_URL = `http://localhost:${PORT}`
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
  // Baselines visuais versionadas, separadas por projeto.
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}',
  projects: [
    {
      name: 'desktop',
      testIgnore: /layout\.spec\.ts/,
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      testIgnore: /layout\.spec\.ts/,
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      // Só para testes de layout (arquivos layout.spec.ts).
      name: 'tablet',
      testMatch: /layout\.spec\.ts/,
      use: { browserName: 'chromium', viewport: { width: 768, height: 1024 } },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: BASE_URL,
    env: { VITE_ENABLE_MOCKS: 'true' },
    // Fora de CI reaproveita o servidor já aberto (que precisa estar com mocks ligados).
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
})
