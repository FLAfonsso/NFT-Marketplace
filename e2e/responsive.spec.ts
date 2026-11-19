import type { Locator, Page } from '@playwright/test'
import { exactLabel, openCollectorForm, signIn } from './account-helpers'
import { ANA_ITEMS } from './data'
import { expect, setScenario, test } from './fixtures'
import { confirmButton } from './shop-helpers'

/**
 * Responsividade e reflow (docs/SPEC.md, seção 8): 390, 768 e 1440 px, mais 320 px (equivale a
 * zoom de 400% em 1280). Mede a página renderizada; não depende de classes CSS.
 */

test.describe.configure({ timeout: 60_000 })

const field = (page: Page, label: string) => page.getByLabel(exactLabel(label))
const catalog = (page: Page) => page.getByRole('region', { name: 'Catálogo de NFTs' })
const cards = (page: Page) =>
  catalog(page).getByRole('listitem').filter({ has: page.getByRole('link', { name: /^Ver / }) })

type PageCase = {
  name: string
  path: string
  /** Precisa de sessão (Ana). */
  auth?: boolean
  /** Espera a página carregar e devolve o botão/controle principal dela. */
  ready: (page: Page, ctx: { desktopLayout: boolean }) => Promise<Locator>
}

const PAGES: PageCase[] = [
  {
    name: 'início',
    path: '/',
    ready: async (page) => {
      await expect(cards(page)).toHaveCount(9)
      return cards(page).first().getByRole('link').first()
    },
  },
  {
    name: 'detalhe do NFT',
    path: `/nft/${ANA_ITEMS.emerald.nftId}`,
    ready: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: ANA_ITEMS.emerald.name })).toBeVisible()
      return page.getByRole('button', { name: /^Comprar/ })
    },
  },
  {
    name: 'carrinho (visitante)',
    path: '/cart',
    ready: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'Carrinho de NFTs' })).toBeAttached()
      await expect(page.getByRole('main')).toBeVisible()
      return page.getByRole('main')
    },
  },
  {
    name: 'carrinho (Ana)',
    path: '/cart',
    auth: true,
    ready: async (page) => {
      await expect(page.getByRole('list', { name: 'Itens do carrinho' }).getByRole('listitem')).toHaveCount(3)
      return page.getByRole('link', { name: 'Conectar e finalizar' })
    },
  },
  {
    name: 'login',
    path: '/login',
    ready: async (page) => {
      await expect(field(page, 'E-mail')).toBeVisible()
      return page.getByRole('button', { name: 'Entrar' })
    },
  },
  {
    name: 'cadastro',
    path: '/signup',
    ready: async (page) => {
      await expect(page.getByLabel('Nome de usuário')).toBeVisible()
      return page.getByRole('button', { name: /^Criar (conta|perfil)$/ })
    },
  },
  {
    name: 'checkout',
    path: '/checkout',
    auth: true,
    ready: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'Pagamento' })).toBeAttached()
      await expect(page.getByRole('list', { name: 'Itens do pedido' }).getByRole('listitem').first()).toBeVisible()
      return confirmButton(page)
    },
  },
  {
    name: 'perfil',
    path: '/profile',
    auth: true,
    ready: async (page) => {
      await expect(field(page, 'Nome de exibição')).not.toHaveValue('')
      return page.getByRole('button', { name: 'Salvar', exact: true })
    },
  },
  {
    name: 'carteiras',
    path: '/wallets',
    auth: true,
    ready: async (page) => {
      const primary = page.getByRole('region', { name: 'Carteira principal' })
      await expect(primary.getByLabel(exactLabel('Endereço da carteira'))).not.toHaveValue('')
      return primary.getByRole('button', { name: 'Salvar carteira' })
    },
  },
  {
    name: 'favoritos',
    path: '/favorites',
    auth: true,
    ready: async (page) => {
      await expect(page.getByRole('main')).toBeVisible()
      await expect(page.getByRole('heading', { level: 1 }).or(page.getByRole('heading', { level: 2 })).first()).toBeVisible()
      return page.getByRole('main')
    },
  },
]

// ---------------------------------------------------------------------------
// Medidas
// ---------------------------------------------------------------------------

/** Sem rolagem horizontal da página. */
async function expectNoHorizontalScroll(page: Page) {
  // A largura é a configurada, não window.innerWidth: com emulação de celular, conteúdo largo
  // faz o navegador ampliar a viewport de layout e a comparação com innerWidth esconderia o erro.
  const width = page.viewportSize()!.width
  const m = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    inner: window.innerWidth,
    body: document.body.scrollWidth,
  }))
  expect(m.scroll, `scrollWidth ${m.scroll} > ${width} (innerWidth ${m.inner}, body ${m.body})`).toBeLessThanOrEqual(width)
  expect(m.inner, `a viewport de layout cresceu para ${m.inner} (conteúdo mais largo que ${width})`).toBeLessThanOrEqual(width)
}

/**
 * Nenhum controle visível fica cortado nas laterais. Controles dentro de uma faixa que rola
 * por desenho (abas, carrossel) não entram: rolar é a forma de chegar neles.
 */
async function expectNothingClipped(page: Page) {
  const clipped = await page.evaluate((width) => {
    const scrolls = (el: Element | null) => {
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        const cs = getComputedStyle(n)
        if (/(auto|scroll)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth) return true
      }
      return false
    }
    const out: string[] = []
    const selector = 'a[href], button, input, select, textarea, [role="tab"], [role="checkbox"], [role="radio"]'
    for (const el of document.querySelectorAll(selector)) {
      const cs = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      if (cs.display === 'none' || cs.visibility === 'hidden' || rect.width < 2 || rect.height < 2) continue
      if (el.closest('[aria-hidden="true"], [inert]') || scrolls(el.parentElement)) continue
      if (rect.left < -1 || rect.right > width + 1) {
        const label = el.getAttribute('aria-label') || (el.textContent ?? '').trim().slice(0, 30) || el.tagName
        out.push(`${el.tagName.toLowerCase()} "${label}" [${Math.round(rect.left)}..${Math.round(rect.right)}] de ${width}`)
      }
    }
    return out
  }, page.viewportSize()!.width)
  expect(clipped, 'controles fora da viewport horizontal').toEqual([])
}

/** O controle principal está inteiro dentro da largura da viewport e acessível. */
async function expectInsideViewport(page: Page, control: Locator) {
  await expect(control).toBeVisible()
  const box = await control.boundingBox()
  const width = page.viewportSize()!.width
  expect(box, 'controle principal sem caixa').not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(-1)
  expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)
}

/** Cabeçalho (>= 768) ou barra inferior (< 768) utilizáveis: cada link visível e dentro da tela. */
async function expectNavigationUsable(page: Page, path: string, desktopLayout: boolean) {
  const inside = async (locator: Locator, what: string) => {
    await expect(locator, what).toBeVisible()
    const box = await locator.boundingBox()
    const width = page.viewportSize()!.width
    expect(box, what).not.toBeNull()
    expect(box!.x, what).toBeGreaterThanOrEqual(-1)
    expect(box!.x + box!.width, what).toBeLessThanOrEqual(width + 1)
  }
  const modal = desktopLayout && (path === '/login' || path === '/signup')
  if (modal) return // o diálogo modal é a página
  if (desktopLayout) {
    await expect(page.getByRole('banner')).toBeVisible()
    const nav = page.getByRole('navigation', { name: 'Principal' })
    await inside(nav.getByRole('link', { name: 'Início' }), 'nav: Início')
    await inside(nav.getByRole('link', { name: 'Mercado' }), 'nav: Mercado')
    await inside(page.getByRole('banner').getByRole('link', { name: /^Carrinho/ }), 'carrinho')
    await inside(page.getByRole('button', { name: 'Buscar', exact: true }), 'busca')
    await inside(
      page.getByRole('banner').getByRole('link', { name: 'Entrar' }).or(page.getByRole('button', { name: /^Menu da conta de / })),
      'entrar / conta',
    )
  } else if (/^\/($|favorites|profile|wallets)/.test(path)) {
    const bar = page.getByRole('navigation', { name: 'Navegação principal' })
    for (const name of ['Início', 'Favoritos', /^Carrinho/, 'Perfil']) {
      await inside(bar.getByRole('link', { name }), `barra inferior: ${String(name)}`)
    }
  }
}

// ---------------------------------------------------------------------------
// 10 e 11. Larguras
// ---------------------------------------------------------------------------

const WIDTHS = [
  { width: 390, height: 844, label: '10', title: '390 px' },
  { width: 768, height: 1024, label: '10', title: '768 px' },
  { width: 1440, height: 900, label: '10', title: '1440 px' },
  { width: 320, height: 640, label: '11', title: '320 px (reflow, zoom de 400% em 1280)' },
]

for (const { width, height, label, title } of WIDTHS) {
  test.describe(`${label}. ${title}`, () => {
    for (const pageCase of PAGES) {
      test(`${pageCase.name}: sem rolagem horizontal, navegação utilizável e nada cortado`, async ({ page }) => {
        await page.setViewportSize({ width, height })
        if (pageCase.auth) await signIn(page, 'ana')
        await page.goto(pageCase.path)
        const desktopLayout = width >= 768
        const principal = await pageCase.ready(page, { desktopLayout })

        await expectNoHorizontalScroll(page)
        await expectInsideViewport(page, principal)
        await expectNavigationUsable(page, pageCase.path, desktopLayout)
        await expectNothingClipped(page)

        // Reflow: o conteúdo principal continua acessível (visível e com cabeçalho de página).
        if (width === 320 && !(desktopLayout && /^\/(login|signup)$/.test(pageCase.path))) {
          await expect(page.getByRole('main')).toBeVisible()
          await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
        }
      })
    }
  })
}

// ---------------------------------------------------------------------------
// 12. Tablet (768)
// ---------------------------------------------------------------------------

test.describe('12. tablet (768 px)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
  })

  test('a sidebar de filtros vira o Sheet e ele funciona', async ({ page }) => {
    await page.goto('/')
    await expect(cards(page)).toHaveCount(9)
    await expect(page.getByRole('complementary', { name: 'Filtros' })).toHaveCount(0)

    await page.getByRole('button', { name: /^Filtros/ }).click()
    const sheet = page.getByRole('dialog', { name: 'Filtros' })
    await expect(sheet).toBeVisible()
    // O Sheet desliza para dentro: espera ele assentar e confere que cabe na tela.
    await expect
      .poll(async () => {
        const box = (await sheet.boundingBox())!
        return box.x >= -1 && box.x + box.width <= 768 + 1
      })
      .toBe(true)

    // Escolhe uma coleção e aplica: a URL e a lista refletem o filtro; o Sheet fecha.
    const collection = sheet.getByRole('group', { name: 'Coleções' }).getByRole('checkbox').first()
    const name = (await sheet.getByRole('group', { name: 'Coleções' }).getByRole('listitem').first().innerText()).split('\n')[0]
    await collection.check()
    await sheet.getByRole('button', { name: 'Aplicar' }).click()
    await expect(sheet).toBeHidden()
    await expect(page).toHaveURL(/collections=/)
    await expect(page.getByRole('button', { name: /^Filtros\s*,\s*1 ativo$/ })).toBeVisible()
    expect(name.length).toBeGreaterThan(0)
    await expectNoHorizontalScroll(page)
  })

  test('o formulário do checkout fica legível', async ({ page }) => {
    await signIn(page, 'ana', '/checkout')
    await openCollectorForm(page, false)
    await expect(field(page, 'E-mail')).not.toHaveValue('')
    const labels = ['Nome de exibição', 'Nome de usuário', 'Endereço da carteira', 'E-mail']
    const rects: { label: string; x: number; y: number; width: number; height: number }[] = []
    for (const label of labels) {
      const input = field(page, label)
      await expect(input).toBeVisible()
      const box = (await input.boundingBox())!
      expect(box.width, `${label}: campo estreito demais`).toBeGreaterThanOrEqual(200)
      expect(box.height, `${label}: campo baixo demais`).toBeGreaterThanOrEqual(32)
      rects.push({ label, ...box })
    }
    // Nenhum campo se sobrepõe a outro.
    for (const a of rects) {
      for (const b of rects) {
        if (a === b) continue
        const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
        expect(overlap, `${a.label} sobrepõe ${b.label}`).toBe(false)
      }
    }
    await expect(confirmButton(page)).toBeVisible()
    await expectNoHorizontalScroll(page)
    await expectNothingClipped(page)
  })

  test('o carrinho fica legível: itens e resumo sem sobreposição', async ({ page }) => {
    await signIn(page, 'ana', '/cart')
    const list = page.getByRole('list', { name: 'Itens do carrinho' })
    await expect(list.getByRole('listitem')).toHaveCount(3)
    const summary = page.getByRole('complementary', { name: 'Resumo da carteira' })
    await expect(summary).toBeVisible()
    for (const row of await list.getByRole('listitem').all()) {
      const box = (await row.boundingBox())!
      expect(box.width, 'linha do carrinho estreita demais').toBeGreaterThanOrEqual(300)
      // Nome e valores não estão truncados com reticências (conteúdo cortado dentro da linha).
      const truncated = await row.evaluate((el) =>
        [...el.querySelectorAll('*')].some((n) => {
          const cs = getComputedStyle(n)
          return cs.textOverflow === 'ellipsis' && n.scrollWidth > n.clientWidth
        }),
      )
      expect(truncated, `linha cortada: ${await row.innerText()}`).toBe(false)
    }
    const a = (await list.boundingBox())!
    const b = (await summary.boundingBox())!
    const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
    expect(overlap, 'lista e resumo se sobrepõem').toBe(false)
    await expectNoHorizontalScroll(page)
    await expectNothingClipped(page)
  })
})

// ---------------------------------------------------------------------------
// 13. Skeleton e recuperação no detalhe
// ---------------------------------------------------------------------------

test.describe('13. detalhe: skeleton e recuperação', () => {
  const url = `/nft/${ANA_ITEMS.emerald.nftId}`
  const loadingStatus = (page: Page) => page.getByRole('status', { name: 'Carregando NFT' })

  test('13a. com o cenário slow o skeleton ocupa o lugar da galeria e das informações, sem salto de layout', async ({
    page,
  }) => {
    await setScenario(page, 'slow', { latencyMs: 2500 })
    // Mede mudanças de layout (CLS) desde o início da carga.
    await page.addInitScript(() => {
      ;(window as unknown as { __cls: number }).__cls = 0
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
          if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value
        }
      }).observe({ type: 'layout-shift', buffered: true })
    })
    await page.goto(url)

    const status = loadingStatus(page)
    await expect(status).toBeVisible()
    // Bones da galeria (o último "quadrado" visível é a imagem principal) e do contêiner.
    const bone = status.locator('.skeleton-bone.aspect-square:visible').last()
    await expect(bone).toBeVisible()
    const skeleton = {
      gallery: (await bone.boundingBox())!,
      grid: (await status.locator('.grid:visible').count()) ? await status.locator('.grid:visible').first().boundingBox() : null,
    }

    // Conteúdo carregado.
    const h1 = page.getByRole('heading', { level: 1, name: ANA_ITEMS.emerald.name })
    await expect(h1).toBeVisible({ timeout: 15_000 })
    await expect(status).toHaveCount(0)
    const zoom = page.getByRole('button', { name: 'Ampliar imagem' })
    const wrapper = zoom.locator('xpath=..')
    const real = {
      gallery: (await wrapper.boundingBox())!,
      grid: await zoom.locator('xpath=../../..').boundingBox(),
    }

    // A galeria ocupa o mesmo retângulo (largura, altura e posição).
    expect(Math.abs(real.gallery.width - skeleton.gallery.width), 'largura da galeria').toBeLessThanOrEqual(1)
    expect(Math.abs(real.gallery.height - skeleton.gallery.height), 'altura da galeria').toBeLessThanOrEqual(1)
    expect(Math.abs(real.gallery.x - skeleton.gallery.x), 'x da galeria').toBeLessThanOrEqual(2)
    expect(Math.abs(real.gallery.y - skeleton.gallery.y), 'y da galeria').toBeLessThanOrEqual(2)

    // Desktop: o contêiner (galeria + informações) tem quase a mesma altura antes e depois.
    if (skeleton.grid && real.grid) {
      const delta = Math.abs(real.grid.height - skeleton.grid.height) / real.grid.height
      expect(delta, `altura do contêiner: skeleton ${skeleton.grid.height}px, real ${real.grid.height}px`).toBeLessThanOrEqual(0.1)
    }

    // Nenhum salto de layout na troca do skeleton pelo conteúdo.
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls)
    expect(cls, `CLS ${cls}`).toBeLessThanOrEqual(0.1)
  })

  test('13b. com server-error o aviso (role=alert) aparece e "Tentar de novo" recupera sem recarregar', async ({
    page,
  }) => {
    // Falhas suficientes para esgotar as novas tentativas automáticas da consulta.
    await setScenario(page, 'server-error', { failures: 20 })
    await page.goto(url)
    await page.evaluate(() => {
      ;(window as unknown as { __same: boolean }).__same = true
    })

    const alert = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar este NFT.' })
    await expect(alert).toBeVisible({ timeout: 20_000 })
    const retry = alert.getByRole('button', { name: 'Tentar de novo' })
    await expect(retry).toBeEnabled()

    await setScenario(page, 'default')
    await retry.click()
    await expect(page.getByRole('heading', { level: 1, name: ANA_ITEMS.emerald.name })).toBeVisible()
    await expect(alert).toHaveCount(0)
    // Mesma página, sem recarga.
    expect(await page.evaluate(() => (window as unknown as { __same?: boolean }).__same)).toBe(true)
  })
})
