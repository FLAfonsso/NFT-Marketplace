import type { Locator, Page } from '@playwright/test'
import { expect, setLatency, test } from './fixtures'
import { USERS } from './credentials'
import { expectLoginRedirect, hrefOf, signIn, submitLoginForm } from './account-helpers'

/**
 * Favoritos (docs/SPEC.md, "Favoritos" e seção 9): coração otimista, persistência, isolamento
 * por usuário, visitante e falha de mutation com rollback e recuperação.
 * Seed: Ana favoritou nft_003, nft_010 e nft_017; Bruno, nft_001.
 */

test.describe.configure({ timeout: 60_000 })

const catalogOf = (page: Page) => page.getByRole('region', { name: 'Catálogo de NFTs' })
const heartOf = (card: Locator) => card.getByRole('button', { name: /favorit/i })

/** Primeiro card do catálogo cujo coração está apagado, e seu nome. */
async function firstUnfavoritedCard(page: Page) {
  const catalog = catalogOf(page)
  const heart = catalog.getByRole('button', { name: /^Favoritar /, pressed: false }).first()
  await expect(heart).toBeVisible({ timeout: 15_000 })
  const name = ((await heart.getAttribute('aria-label')) ?? '').replace(/^Favoritar /, '')
  const card = catalog
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: `Ver ${name}` }) })
  return { name, card, heart: heartOf(card) }
}

const detailHeart = (page: Page) => page.getByRole('button', { name: 'Favoritar', exact: true })
const favoriteRequest = (method: string) => (r: { url(): string; request(): { method(): string } }) =>
  r.url().includes('/api/favorites/') && r.request().method() === method

/** Clica no coração e devolve a resposta da API (a espera é registrada antes do clique). */
async function click(page: Page, heart: Locator, method: 'PUT' | 'DELETE') {
  const response = page.waitForResponse(favoriteRequest(method))
  await heart.click()
  return response
}

test('10a. catálogo: favoritar e desfavoritar muda o coração na hora e persiste após F5', async ({ page }) => {
  await signIn(page, 'ana', '/')
  const { name, card, heart } = await firstUnfavoritedCard(page)
  await setLatency(page, 3_000) // o coração tem de mudar antes da resposta da API

  const put = click(page, heart, 'PUT')
  await expect(heart).toHaveAttribute('aria-pressed', 'true', { timeout: 2_000 })
  await expect(heart).toHaveAccessibleName(`Remover ${name} dos favoritos`)
  await put
  await setLatency(page, 150)

  await page.reload()
  const after = catalogOf(page)
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: `Ver ${name}` }) })
  await expect(heartOf(after)).toHaveAttribute('aria-pressed', 'true')

  await setLatency(page, 3_000)
  const del = click(page, heartOf(after), 'DELETE')
  await expect(heartOf(after)).toHaveAttribute('aria-pressed', 'false', { timeout: 2_000 })
  await del
  await setLatency(page, 150)
  await page.reload()
  await expect(heartOf(card)).toHaveAttribute('aria-pressed', 'false')
})

test('10b. detalhe: favoritar e desfavoritar muda na hora e persiste após F5', async ({ page }) => {
  await signIn(page, 'ana', '/nft/nft_002')
  const heart = detailHeart(page)
  await expect(heart).toHaveAttribute('aria-pressed', 'false')
  await setLatency(page, 3_000)

  const put = click(page, heart, 'PUT')
  await expect(heart).toHaveAttribute('aria-pressed', 'true', { timeout: 2_000 })
  await put
  await setLatency(page, 150)
  await page.reload()
  await expect(detailHeart(page)).toHaveAttribute('aria-pressed', 'true')

  await setLatency(page, 3_000)
  const del = click(page, detailHeart(page), 'DELETE')
  await expect(detailHeart(page)).toHaveAttribute('aria-pressed', 'false', { timeout: 2_000 })
  await del
  await setLatency(page, 150)
  await page.reload()
  await expect(detailHeart(page)).toHaveAttribute('aria-pressed', 'false')
})

test('10c. /favorites lista os NFTs favoritados do usuário', async ({ page }) => {
  await signIn(page, 'ana', '/nft/nft_002')
  await click(page, detailHeart(page), 'PUT')
  const name = await page.getByRole('heading', { level: 1 }).first().innerText()

  await page.goto('/favorites')
  const list = page.getByRole('main')
  await expect(list.getByText(name).first()).toBeVisible()
  // E os do seed da Ana (nft_003, nft_010, nft_017) também estão lá.
  await expect(list.locator('a[href="/nft/nft_003"]').first()).toBeVisible()
  await expect(list.locator('a[href="/nft/nft_010"]').first()).toBeVisible()
  await expect(list.locator('a[href="/nft/nft_017"]').first()).toBeVisible()

  await page.reload()
  await expect(list.locator('a[href="/nft/nft_003"]').first()).toBeVisible()
})

test('10d. isolamento: o outro usuário não vê os favoritos da Ana', async ({ page }) => {
  await signIn(page, 'ana', '/nft/nft_002')
  await click(page, detailHeart(page), 'PUT')
  await expect(detailHeart(page)).toHaveAttribute('aria-pressed', 'true')

  // Sai pelo menu (desktop) ou limpando a sessão pela própria interface do perfil (mobile).
  await page.goto('/profile')
  const logout = page.getByRole('navigation', { name: 'Meu perfil' }).getByRole('button', { name: 'Sair' })
  await logout.click()
  await expect(page).toHaveURL(/\/$/)

  await signIn(page, 'bruno', '/nft/nft_002')
  await expect(detailHeart(page)).toHaveAttribute('aria-pressed', 'false') // favorito da Ana
  await page.goto('/nft/nft_003')
  await expect(detailHeart(page)).toHaveAttribute('aria-pressed', 'false') // favorito do seed da Ana
  await page.goto('/nft/nft_001')
  await expect(detailHeart(page)).toHaveAttribute('aria-pressed', 'true') // o do próprio Bruno

  await page.goto('/favorites')
  await expect(page.getByRole('main').locator('a[href="/nft/nft_003"]')).toHaveCount(0)
  await expect(page.getByRole('main').locator('a[href="/nft/nft_002"]')).toHaveCount(0)
})

test('11a. visitante favoritando no catálogo vai ao login e volta à rota depois de entrar', async ({ page }) => {
  await page.goto('/')
  const { heart } = await firstUnfavoritedCard(page)
  const here = hrefOf(page)

  await heart.click()
  await expectLoginRedirect(page, here)

  await submitLoginForm(page, USERS.ana.email, USERS.ana.password)
  await expect(page).toHaveURL(new RegExp(`${here === '/' ? '/$' : here}`))
  await expect(catalogOf(page)).toBeVisible()
})

test('11b. visitante favoritando no detalhe vai ao login e volta ao detalhe', async ({ page }) => {
  await page.goto('/nft/nft_002')
  await detailHeart(page).click()
  await expectLoginRedirect(page, '/nft/nft_002')

  await submitLoginForm(page, USERS.ana.email, USERS.ana.password)
  await expect(page).toHaveURL(/\/nft\/nft_002$/)
  await expect(detailHeart(page)).toHaveAttribute('aria-pressed', 'false')
})

test('12a. falha ao favoritar: otimista, rollback e aviso acessível; depois recupera', async ({ page }) => {
  await signIn(page, 'ana', '/nft/nft_002')
  const heart = detailHeart(page)
  await expect(heart).toHaveAttribute('aria-pressed', 'false')

  await setLatency(page, 3_000)
  await page.evaluate(() => window.__mocks!.failNext({ method: 'PUT', path: '/api/favorites/', status: 500, times: 1 }))
  const failed = click(page, heart, 'PUT')
  await expect(heart).toHaveAttribute('aria-pressed', 'true', { timeout: 2_000 }) // otimista
  expect((await failed).status()).toBe(500)
  await expect(heart).toHaveAttribute('aria-pressed', 'false') // rollback
  await expect(
    page.locator('[aria-live]').getByText('Não foi possível favoritar. Tente de novo.'),
  ).toBeVisible()

  // Recuperação: sem a falha, favoritar funciona e persiste.
  await setLatency(page, 150)
  await expect(heart).toBeEnabled()
  const ok = click(page, heart, 'PUT')
  await expect(heart).toHaveAttribute('aria-pressed', 'true')
  expect((await ok).status()).toBe(200)
  await page.reload()
  await expect(detailHeart(page)).toHaveAttribute('aria-pressed', 'true')
})

test('12b. falha ao desfavoritar: rollback para favoritado e aviso; depois recupera', async ({ page }) => {
  await signIn(page, 'ana', '/nft/nft_003') // favorito do seed
  const heart = detailHeart(page)
  await expect(heart).toHaveAttribute('aria-pressed', 'true')

  await setLatency(page, 3_000)
  await page.evaluate(() => window.__mocks!.failNext({ method: 'DELETE', path: '/api/favorites/', status: 503, times: 1 }))
  const failed = click(page, heart, 'DELETE')
  await expect(heart).toHaveAttribute('aria-pressed', 'false', { timeout: 2_000 })
  expect((await failed).status()).toBe(503)
  await expect(heart).toHaveAttribute('aria-pressed', 'true')
  await expect(
    page.locator('[aria-live]').getByText('Não foi possível remover dos favoritos. Tente de novo.'),
  ).toBeVisible()

  await setLatency(page, 150)
  await expect(heart).toBeEnabled()
  const ok = click(page, heart, 'DELETE')
  await expect(heart).toHaveAttribute('aria-pressed', 'false')
  expect((await ok).status()).toBe(200)
  await page.reload()
  await expect(detailHeart(page)).toHaveAttribute('aria-pressed', 'false')
})
