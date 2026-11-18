import type { Locator, Page } from '@playwright/test'
import { expect } from './fixtures'
import { USERS, type UserKey } from './credentials'

/**
 * Helpers compartilhados pelos testes de conta (account-*.spec.ts). Funcionam no desktop e no
 * mobile: no mobile não há header com nome nem "Sair" no menu, então o fluxo usa a barra
 * inferior ("Perfil") e o "Sair" do menu "Meu perfil".
 */

export const TOKEN_KEY = 'nft-marketplace:session-token'
/** Estado da API simulada (o "servidor"): não é dado do app e fica fora das verificações de storage. */
const MOCK_PREFIX = 'nft-marketplace:mocks:'

export type NewAccount = { name: string; email: string; password: string }

export const NEW_ACCOUNT: NewAccount = {
  name: 'Novo Colecionador',
  email: 'novo.colecionador@example.com',
  password: 'senha-nova-123',
}

// ---------------------------------------------------------------------------
// URL
// ---------------------------------------------------------------------------

/** Valor do search param `redirect` (o app grava strings como JSON: "/checkout" vira "\"/checkout\""). */
export function redirectParam(page: Page): string | null {
  const raw = new URL(page.url()).searchParams.get('redirect')
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'string' ? parsed : raw
  } catch {
    return raw
  }
}

export const hrefOf = (page: Page) => {
  const url = new URL(page.url())
  return `${url.pathname}${url.search}${url.hash}`
}

export async function expectLoginRedirect(page: Page, to: string) {
  await expect(page).toHaveURL(/\/login(\?|$)/)
  expect(new URL(page.url()).pathname).toBe('/login')
  expect(redirectParam(page)).toBe(to)
}

// ---------------------------------------------------------------------------
// Login, cadastro e logout (pela interface)
// ---------------------------------------------------------------------------

const submitLogin = (page: Page) => page.getByRole('button', { name: 'Entrar' })

/** Preenche e envia o formulário de /login (a página já deve estar nele). */
export async function submitLoginForm(page: Page, email: string, password: string) {
  await page.getByLabel(exactLabel('E-mail')).fill(email)
  await page.getByLabel(exactLabel('Senha')).fill(password)
  const response = page.waitForResponse(
    (r) => r.url().includes('/auth/login') && r.request().method() === 'POST',
  )
  await submitLogin(page).click()
  return response
}

/** Entra pela interface (/login) e espera sair da tela; `then` é a página aberta em seguida. */
export async function signIn(page: Page, user: UserKey, then?: string) {
  const { email, password } = USERS[user]
  await page.goto('/login')
  await submitLoginForm(page, email, password)
  await expect(page).not.toHaveURL(/\/login/)
  if (then) await page.goto(then)
}

/** Preenche o formulário de /signup. */
export async function fillSignup(
  page: Page,
  account: { name: string; email: string; password: string; confirm?: string },
) {
  await page.getByLabel('Nome de usuário').fill(account.name)
  await page.getByLabel(exactLabel('E-mail')).fill(account.email)
  await page.getByLabel(exactLabel('Senha')).fill(account.password)
  await page.getByLabel('Confirmar senha').fill(account.confirm ?? account.password)
}

export const signupButton = (page: Page) => page.getByRole('button', { name: /^Criar (conta|perfil)$/ })

/** Cadastro completo em /signup; espera sair da tela. */
export async function signUp(page: Page, account: NewAccount = NEW_ACCOUNT) {
  await page.goto('/signup')
  await fillSignup(page, account)
  const response = page.waitForResponse(
    (r) => r.url().includes('/auth/register') && r.request().method() === 'POST',
  )
  await signupButton(page).click()
  await response
  await expect(page).not.toHaveURL(/\/signup/)
}

const mobileNav = (page: Page) => page.getByRole('navigation', { name: 'Navegação principal' })
const profileNav = (page: Page) => page.getByRole('navigation', { name: 'Meu perfil' })

/** Abre /profile pelo controle da plataforma: menu da conta (desktop) ou barra inferior (mobile). */
export async function openProfile(page: Page, isMobile: boolean) {
  if (isMobile) {
    await mobileNav(page).getByRole('link', { name: 'Perfil' }).click()
  } else {
    await page.getByRole('button', { name: /^Menu da conta de / }).click()
    await page.getByRole('menuitem', { name: 'Perfil' }).click()
  }
  await expect(page).toHaveURL(/\/profile$/)
}

/** Vai a uma tela da conta ("Carteiras", "Dados do perfil") pelo menu "Meu perfil" (lateral ou abas). */
export const goToAccountSection = (page: Page, name: 'Carteiras' | 'Dados do perfil') =>
  profileNav(page).getByRole('link', { name }).click()

/** Logout: menu do header (desktop) ou "Sair" do "Meu perfil" (mobile). */
export async function signOut(page: Page, isMobile: boolean) {
  if (isMobile) {
    if (!/\/(profile|wallets)$/.test(new URL(page.url()).pathname)) await openProfile(page, true)
    await profileNav(page).getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/$/)
  } else {
    await page.getByRole('button', { name: /^Menu da conta de / }).click()
    await page.getByRole('menuitem', { name: 'Sair' }).click()
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
  }
}

/** Há sessão? Desktop: o header mostra o nome. Mobile: "Perfil" abre /profile em vez do login. */
export async function expectSignedIn(page: Page, isMobile: boolean, name?: string) {
  if (!isMobile) {
    // O diálogo de login ainda pode estar fechando (e o resto da página fica inerte atrás dele).
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: name ? `Menu da conta de ${name}` : /^Menu da conta de / }),
    ).toBeVisible()
    return
  }
  await openProfile(page, true)
  if (name) await expect(page.getByLabel(exactLabel('Nome de exibição'))).toHaveValue(name)
}

/** Sem sessão: desktop mostra "Entrar"; mobile leva "Perfil" ao login. */
export async function expectSignedOut(page: Page, isMobile: boolean) {
  if (!isMobile) {
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Menu da conta de / })).toHaveCount(0)
    return
  }
  await mobileNav(page).getByRole('link', { name: 'Perfil' }).click()
  await expectLoginRedirect(page, '/profile')
}

// ---------------------------------------------------------------------------
// Formulários
// ---------------------------------------------------------------------------

/** O campo está marcado como inválido e a mensagem está ligada a ele por aria-describedby. */
export async function expectFieldError(field: Locator, message: string | RegExp) {
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  const describedBy = await field.getAttribute('aria-describedby')
  expect(describedBy, 'campo sem aria-describedby').toBeTruthy()
  const ids = describedBy!.split(/\s+/)
  const texts = await Promise.all(
    ids.map((id) => field.page().locator(`[id="${id}"]`).first().textContent()),
  )
  const joined = texts.join(' ')
  if (typeof message === 'string') expect(joined).toContain(message)
  else expect(joined).toMatch(message)
}

/** Conta as requisições (método + trecho da URL) vistas pela página. */
export function countRequests(page: Page, method: string, urlPart: string) {
  const state = { count: 0 }
  page.on('request', (request) => {
    if (request.method() === method && request.url().includes(urlPart)) state.count += 1
  })
  return state
}

/** No mobile o formulário do colecionador fica recolhido ("Dados do colecionador"): expande. */
export async function openCollectorForm(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole('button', { name: /^Dados do colecionador/ }).click()
  await expect(page.getByLabel('Observação do colecionador (opcional)')).toBeVisible()
}

// ---------------------------------------------------------------------------
// Armazenamento e cache
// ---------------------------------------------------------------------------

export type StorageEntry = { area: 'local' | 'session'; key: string; value: string }

/** Tudo em localStorage/sessionStorage, menos o banco da API simulada. */
export const appStorage = (page: Page): Promise<StorageEntry[]> =>
  page.evaluate((mockPrefix) => {
    const out: { area: 'local' | 'session'; key: string; value: string }[] = []
    for (const [area, storage] of [
      ['local', localStorage],
      ['session', sessionStorage],
    ] as const) {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)!
        if (key.startsWith(mockPrefix)) continue
        out.push({ area, key, value: storage.getItem(key) ?? '' })
      }
    }
    return out
  }, MOCK_PREFIX)

export type QueryCacheDump = {
  queries: { queryKey: unknown[]; data: unknown }[]
  mutations: { variables: unknown }[]
}

export const queryCache = (page: Page): Promise<QueryCacheDump> =>
  page.evaluate(() => window.__mocks!.inspectQueryCache() as Promise<QueryCacheDump>)

/** Chaves do cache de consultas, como texto (para procurar ids de usuário). */
export const queryKeysText = async (page: Page) =>
  (await queryCache(page)).queries.map((q) => JSON.stringify(q.queryKey))

// ---------------------------------------------------------------------------
// API (os mesmos handlers do app, chamados de dentro da página)
// ---------------------------------------------------------------------------

/** fetch autenticado com o token da sessão atual. */
export function apiAs<T = unknown>(
  page: Page,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: T }> {
  return page.evaluate(
    async ([m, p, b, tokenKey]) => {
      const token = localStorage.getItem(tokenKey as string)
      const response = await fetch(`/api${p as string}`, {
        method: m as string,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(b === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: b === undefined ? undefined : JSON.stringify(b),
      })
      const text = await response.text()
      return { status: response.status, body: (text ? JSON.parse(text) : null) as never }
    },
    [method, path, body, TOKEN_KEY] as const,
  )
}

type ApiWallet = {
  id: string
  role: 'primary' | 'secondary'
  nickname: string
  address: string
  displayName: string
  username: string
  network: string
  profileName: string
  walletType: string
  referralCode: string
  email: string
  ensName: string
}

export const apiWallets = async (page: Page) =>
  (await apiAs<{ items: ApiWallet[] }>(page, 'GET', '/wallets')).body.items

/**
 * Cria, pela API, um pedido pendente do usuário logado (itens do carrinho dele). Use com
 * configure({ orderSettleMs }) alto para ele continuar pendente.
 */
export async function createPendingOrder(page: Page): Promise<string> {
  const cart = (await apiAs<{ items: { nftId: string; editionId: string; quantity: number }[] }>(page, 'GET', '/cart')).body
  const items = cart.items.map(({ nftId, editionId, quantity }) => ({ nftId, editionId, quantity }))
  const quote = await apiAs<{ id: string }>(page, 'POST', '/quote', { items })
  expect(quote.status).toBe(200)
  const wallet = (await apiWallets(page)).find((w) => w.role === 'primary')!
  const key = await page.evaluate(() => crypto.randomUUID())
  const created = await page.evaluate(
    async ([k, quoteId, list, w, tokenKey]) => {
      const token = localStorage.getItem(tokenKey as string)!
      const wallet = w as Record<string, string>
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': k as string,
        },
        body: JSON.stringify({
          idempotencyKey: k,
          quoteId,
          items: list,
          walletId: wallet.id,
          displayName: wallet.displayName,
          username: wallet.username,
          network: wallet.network,
          profileName: wallet.profileName,
          address: wallet.address,
          walletType: wallet.walletType,
          referralCode: wallet.referralCode,
          email: wallet.email,
          ensName: wallet.ensName,
        }),
      })
      return { status: response.status, body: (await response.json()) as { id: string } }
    },
    [key, quote.body.id, items, wallet, TOKEN_KEY] as const,
  )
  expect(created.status, JSON.stringify(created.body)).toBe(201)
  return created.body.id
}

declare global {
  interface Window {
    /** Diagnóstico do tempo real, só em dev (src/features/realtime/useRealtimeSync.ts). */
    __realtime?: { diagnostics: () => unknown }
  }
}

/** Rótulo exato, tolerando o asterisco de campo obrigatório (<span aria-hidden>*</span>) dentro do <label>. */
export const exactLabel = (label: string) =>
  new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\*?$')
