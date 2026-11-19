import type { Page } from '@playwright/test'
import { exactLabel, openCollectorForm, signIn } from './account-helpers'
import { ANA_CART, ANA_ITEMS, totalsOf } from './data'
import { expect, test } from './fixtures'
import { chooseWallet, expectCartSummary } from './shop-helpers'

/**
 * Regressão visual (docs/SPEC.md, seção 9): início, detalhe, carrinho e pagamento, em desktop
 * (1440x900) e mobile (390x844), os viewports dos projetos. Baselines em
 * e2e/__screenshots__/<projeto>/visual.spec.ts/, versionadas (ver README, "Testes").
 */

/** 2026-11-01 12:00 UTC: o relógio da página fica parado, sem congelar timers. */
const FIXED_TIME = new Date('2026-11-01T12:00:00.000Z')

// Movimento reduzido: o carrossel do hero não troca sozinho e o shimmer não anima.
test.use({ reducedMotion: 'reduce' })

test.describe.configure({ timeout: 60_000 })

test.beforeEach(async ({ page }) => {
  // O fixture já deixou o estado limpo e o cenário default; só falta o relógio fixo, que vale
  // para as páginas carregadas daqui em diante.
  await page.clock.setFixedTime(FIXED_TIME)
})

/** Fontes carregadas, todas as imagens baixadas e decodificadas, rolagem no topo. */
async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  // Imagens "lazy" fora da tela não carregam sozinhas numa captura de página inteira.
  await page.evaluate(() => {
    document.querySelectorAll('img[loading="lazy"]').forEach((img) => ((img as HTMLImageElement).loading = 'eager'))
  })
  await expect
    .poll(() => page.evaluate(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0)), {
      message: 'imagens ainda carregando',
    })
    .toBe(true)
  await page.evaluate(() => window.scrollTo(0, 0))
  // Um quadro para o layout assentar depois das imagens e das fontes.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

const shot = { fullPage: true, animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.01 } as const

test('14a. início: catálogo carregado, 9 cards, hero parado', async ({ page }) => {
  await page.goto('/')
  const cards = page
    .getByRole('region', { name: 'Catálogo de NFTs' })
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: /^Ver / }) })
  await expect(cards).toHaveCount(9)
  await settle(page)
  await expect(page).toHaveScreenshot('home.png', shot)
})

test('14b. detalhe do Emerald Ape #042', async ({ page }) => {
  await page.goto(`/nft/${ANA_ITEMS.emerald.nftId}`)
  await expect(page.getByRole('heading', { level: 1, name: ANA_ITEMS.emerald.name })).toBeVisible()
  await settle(page)
  await expect(page).toHaveScreenshot('detail-emerald-ape-042.png', shot)
})

test('14c. carrinho da Ana (26.83 / 0.016 / 26.846)', async ({ page }) => {
  await signIn(page, 'ana', '/cart')
  await expect(page.getByRole('list', { name: 'Itens do carrinho' }).getByRole('listitem')).toHaveCount(3)
  await expectCartSummary(page, totalsOf(ANA_CART))
  await settle(page)
  await expect(page).toHaveScreenshot('cart-ana.png', shot)
})

test('14d. pagamento da Ana: carteira selecionada, formulário vazio', async ({ page, isMobile }) => {
  await signIn(page, 'ana', '/checkout')
  await openCollectorForm(page, isMobile)
  await expect(page.getByLabel(exactLabel('E-mail'))).not.toHaveValue('')
  await chooseWallet(page, 'Principal')
  // Formulário vazio: limpa o que o app pré-preencheu com o perfil da Ana.
  for (const label of ['Nome de exibição', 'Nome de usuário', 'Nome do perfil', 'Código de indicação', 'E-mail', 'Nome ENS']) {
    await page.getByLabel(exactLabel(label)).fill('')
  }
  await page.getByLabel('Observação do colecionador (opcional)').fill('')
  // Tira o foco do último campo sem validar nem mexer no layout.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await settle(page)
  await expect(page).toHaveScreenshot('checkout-ana.png', shot)
})
