import { test as base, expect, type Page } from '@playwright/test'
import { USERS, type UserKey } from './credentials'

type Mocks = NonNullable<Window['__mocks']>

/** Espera o MSW subir e window.__mocks existir (main.tsx só renderiza depois do worker). */
async function waitForMocks(page: Page) {
  await page.waitForFunction(() => window.__mocks !== undefined)
}

/** Estado limpo: storages vazios, banco dos mocks restaurado e cenário "default". */
async function resetState(page: Page) {
  await page.goto('/')
  await waitForMocks(page)
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
    window.__mocks!.reset()
    window.__mocks!.setScenario('default')
  })
  // O banco simulado é persistido no localStorage; recarrega para o app ler o estado novo.
  await page.reload()
  await waitForMocks(page)
}

export const setScenario = (page: Page, name: string, options?: Record<string, unknown>) =>
  page.evaluate(
    ([n, o]) => window.__mocks!.setScenario(n as never, o as never),
    [name, options] as const,
  )

/** Login pela interface (formulário em /login), sem atalhos de sessão. */
export async function loginAs(page: Page, user: UserKey) {
  const { email, password, name } = USERS[user]
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  const login = page.waitForResponse(
    (r) => r.url().includes('/auth/login') && r.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Entrar' }).click()
  await login
  await expect(page.getByRole('button', { name: `Menu da conta de ${name}` })).toBeVisible()
}

/** Logout pelo menu da conta. */
export async function logout(page: Page) {
  await page.getByRole('button', { name: /^Menu da conta de / }).click()
  await page.getByRole('menuitem', { name: 'Sair' }).click()
  await expect(page.getByRole('button', { name: /^Menu da conta de / })).toHaveCount(0)
}

/** Tempo real: passa pelo socket.io-client do app, nunca mexe no cache. */
export const emitNftUpdate = (page: Page, input: Parameters<Mocks['emitNftUpdate']>[0]) =>
  page.evaluate((i) => window.__mocks!.emitNftUpdate(i), input)
export const emitOrderUpdate = (page: Page, input: Parameters<Mocks['emitOrderUpdate']>[0]) =>
  page.evaluate((i) => window.__mocks!.emitOrderUpdate(i), input)
export const emitDuplicate = (page: Page) => page.evaluate(() => window.__mocks!.emitDuplicate())
export const emitStale = (page: Page) => page.evaluate(() => window.__mocks!.emitStale())
export const disconnectSockets = (page: Page) =>
  page.evaluate(() => window.__mocks!.disconnectSockets())
export const reconnectSockets = (page: Page) =>
  page.evaluate(() => window.__mocks!.reconnectSockets())

/** Evento perdido: muda preço/estoque no servidor SEM emitir nft.updated (ver docs/REALTIME.md). */
export const updateNftSilently = (page: Page, input: Parameters<Mocks['updateNftSilently']>[0]) =>
  page.evaluate((i) => window.__mocks!.updateNftSilently(i), input)
/** Evento perdido: liquida um pedido pendente no servidor SEM emitir order.updated. */
export const settleOrderSilently = (page: Page, orderId: string, status: 'confirmed' | 'rejected') =>
  page.evaluate(([id, s]) => window.__mocks!.settleOrderSilently(id, s), [orderId, status] as const)
/** Contadores de handshake do Socket.IO simulado ({ accepted, rejected, refused }). */
export const socketStats = (page: Page) => page.evaluate(() => window.__mocks!.socketStats())
/**
 * Segura os pedidos criados daqui em diante em "pending" (liquidação adiada por 1 h), até o teste
 * liberar com emitOrderUpdate (com evento) ou settleOrderSilently (sem evento). Vale até recarregar
 * a página (a configuração fica em memória); o pedido já criado guarda o prazo no banco simulado.
 */
export const holdOrdersPending = (page: Page) =>
  page.evaluate(() => window.__mocks!.configure({ orderSettleMs: 3_600_000 }))
export const expireSessions = (page: Page, userId?: string) =>
  page.evaluate((id) => window.__mocks!.expireSessions(id), userId)

/** Latência fixa das respostas REST dos mocks (para skeletons e carregamento lento). */
export const setLatency = (page: Page, latencyMs: number) =>
  page.evaluate((ms) => window.__mocks!.configure({ latencyMs: ms }), latencyMs)

/**
 * Relógio controlado (page.clock). Instala o relógio falso e recarrega a página, pois ele só
 * vale para scripts carregados depois. Depois use page.clock.fastForward / runFor.
 */
export async function useClock(page: Page, time: string | number | Date = '2026-11-01T12:00:00.000Z') {
  await page.clock.install({ time: new Date(time) })
  await page.reload()
  await waitForMocks(page)
}

export const test = base.extend({
  // Cada teste já recebe um context novo; aqui só garantimos o estado dos mocks.
  page: async ({ page }, use) => {
    await resetState(page)
    await use(page)
  },
})

export { expect }
