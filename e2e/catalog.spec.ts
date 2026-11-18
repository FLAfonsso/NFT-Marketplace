import type { Locator, Page } from '@playwright/test'
import { expect, setScenario, test } from './fixtures'

/**
 * Catálogo e detalhe (docs/SPEC.md, "Catálogo e detalhe" e seção 9).
 * Observa interface e URL; os dados vêm dos handlers MSW reais. Para comparar com a API, o teste
 * chama GET /api/nfts de dentro da página (fetch), porque o MSW roda no service worker do
 * navegador e page.request (lado Node) não passa por ele.
 */

// ---------------------------------------------------------------------------
// API (os mesmos handlers que o app usa)
// ---------------------------------------------------------------------------

type ApiFacet = { id: string; name: string; count: number }
type ApiNft = {
  id: string
  name: string
  price: string
  collection: string
  network: string
  editions: { id: string; name: string; available: number; maxPerOrder: number }[]
}
type ApiList = {
  items: ApiNft[]
  total: number
  totalPages: number
  page: number
  facets: { collections: ApiFacet[]; networks: ApiFacet[] }
}

async function apiList(page: Page, params: URLSearchParams | string): Promise<ApiList> {
  const qs = params.toString()
  return page.evaluate(async (query) => {
    const response = await fetch(`/api/nfts?${query}`)
    if (!response.ok) throw new Error(`GET /api/nfts falhou: ${response.status}`)
    return (await response.json()) as ApiList
  }, qs)
}

async function apiNft(page: Page, id: string): Promise<ApiNft> {
  return page.evaluate(async (nftId) => {
    const response = await fetch(`/api/nfts/${nftId}`)
    if (!response.ok) throw new Error(`GET /api/nfts/${nftId} falhou: ${response.status}`)
    return (await response.json()) as ApiNft
  }, id)
}

/** O catálogo inteiro (36 NFTs) de uma vez, para escolher dados de teste sem números fixos. */
const apiAll = (page: Page) => apiList(page, 'pageSize=48')

const API_KEYS = ['q', 'view', 'collections', 'networks', 'priceMin', 'priceMax', 'sort', 'page']

/** Parâmetros da API equivalentes aos da URL atual (o que a interface deveria ter enviado). */
function apiParamsFromUrl(page: Page): URLSearchParams {
  const out = new URLSearchParams()
  const url = new URL(page.url())
  for (const key of API_KEYS) {
    for (const raw of url.searchParams.getAll(key)) {
      let value: unknown = raw
      try {
        value = JSON.parse(raw)
      } catch {
        // texto puro (ex.: q=Golden)
      }
      if (Array.isArray(value)) for (const item of value) out.append(key, String(item))
      else out.append(key, String(value))
    }
  }
  out.set('pageSize', '9')
  return out
}

/** Valor de um search param da URL, já decodificado (null se ausente). */
function urlParam(page: Page, key: string): unknown {
  const raw = new URL(page.url()).searchParams.get(key)
  if (raw === null) return null
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

const catalogOf = (page: Page) => page.getByRole('region', { name: 'Catálogo de NFTs' })

/** Card = item de lista com o link "Ver <nome>" (esgotados não têm "Adicionar"). */
const cardsOf = (page: Page) =>
  catalogOf(page)
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: /^Ver / }) })

const cardIds = async (page: Page) =>
  (
    await cardsOf(page)
      .getByRole('link', { name: /^Ver / })
      .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''))
  ).map((href) => href.split('/').pop() ?? '')

const cardNames = async (page: Page) =>
  (
    await cardsOf(page)
      .getByRole('link', { name: /^Ver / })
      .evaluateAll((links) => links.map((link) => link.getAttribute('aria-label') ?? ''))
  ).map((label) => label.replace(/^Ver /, ''))

/** Preço (número) lido do texto do card, em ETH. */
async function cardPrices(page: Page): Promise<number[]> {
  const cards = await cardsOf(page).all()
  return Promise.all(
    cards.map(async (card) => {
      const text = await card.getByRole('link').first().innerText()
      const match = /(\d+(?:\.\d+)?)\s*ETH/.exec(text)
      if (!match) throw new Error(`Preço não encontrado no card: ${text}`)
      return Number(match[1])
    }),
  )
}

const totalText = (page: Page) => catalogOf(page).getByText(/^\d+ NFTs?$/)
const paginationOf = (page: Page) => page.getByRole('navigation', { name: 'Paginação' })
const sortTrigger = (page: Page) => page.getByRole('combobox', { name: 'Ordenar por:' })
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Lista, total e página atual da tela batem com GET /api/nfts feito com os parâmetros da URL. */
async function expectListMatchesApi(page: Page) {
  await expect(async () => {
    const api = await apiList(page, apiParamsFromUrl(page))
    expect(await cardIds(page)).toEqual(api.items.map((item) => item.id))
    await expect(totalText(page)).toHaveText(`${api.total} ${api.total === 1 ? 'NFT' : 'NFTs'}`, {
      timeout: 1_000,
    })
  }).toPass()
}

async function searchFor(page: Page, mobile: boolean, term: string) {
  if (mobile) {
    await page.getByRole('searchbox', { name: 'Explorar coleções' }).fill(term)
    return
  }
  const box = page.getByRole('searchbox', { name: 'Buscar NFTs' })
  if ((await box.count()) === 0) await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await box.fill(term)
}

async function chooseSort(page: Page, label: string) {
  await sortTrigger(page).click()
  await page.getByRole('option', { name: label }).click()
}

/** Leva o slider (passos de 0,01 ETH) até `target`, descobrindo o passo grande pelo próprio teclado. */
async function setSlider(slider: Locator, target: number) {
  for (let i = 0; i < 400; i++) {
    const diff = target - Number(await slider.inputValue())
    if (diff === 0) return
    await slider.press(Math.abs(diff) >= 10 ? (diff > 0 ? 'PageUp' : 'PageDown') : diff > 0 ? 'ArrowRight' : 'ArrowLeft')
  }
  throw new Error(`Slider não chegou a ${target}`)
}

type Filters = {
  collection?: string
  network?: string
  /** Em ETH. */
  price?: { min?: number; max?: number }
}

/**
 * Aplica filtros pela interface. Desktop: sidebar (coleção e rede aplicam ao marcar, preço em
 * "Aplicar"). Mobile: Sheet de filtros com um único "Aplicar".
 */
async function applyFilters(page: Page, mobile: boolean, filters: Filters) {
  let panel: Locator
  if (mobile) {
    await page.getByRole('button', { name: /^Filtros/ }).click()
    panel = page.getByRole('dialog', { name: 'Filtros' })
    await expect(panel).toBeVisible()
  } else {
    panel = page.getByRole('complementary', { name: 'Filtros' })
  }

  for (const [group, label] of [
    ['collection', filters.collection],
    ['network', filters.network],
  ] as const) {
    if (!label) continue
    const box = panel.getByRole('checkbox', { name: new RegExp(`^${escapeRegExp(label)}`) })
    await box.click()
    await expect(box, `${group} ${label} marcada`).toBeChecked()
  }

  if (filters.price?.min !== undefined) {
    await setSlider(panel.getByRole('slider', { name: 'Preço mínimo' }), Math.round(filters.price.min * 100))
  }
  if (filters.price?.max !== undefined) {
    await setSlider(panel.getByRole('slider', { name: 'Preço máximo' }), Math.round(filters.price.max * 100))
  }

  if (mobile) {
    await panel.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await expect(panel).toBeHidden()
  } else if (filters.price) {
    await panel.getByRole('button', { name: 'Aplicar', exact: true }).click()
  }
}

/** Formato de ETH do app: ponto, mínimo de 2 casas, sem zeros além disso. */
function formatEth(value: string) {
  const [int, frac = ''] = value.split('.')
  return `${int}.${frac.replace(/0+$/, '').padEnd(2, '0')}`
}

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

test('1. busca filtra a lista, entra na URL e limpar restaura os 9 itens', async ({ page, isMobile }) => {
  await expect(cardsOf(page)).toHaveCount(9)

  await searchFor(page, isMobile, 'Golden')
  await expect.poll(() => urlParam(page, 'q')).toBe('Golden')

  const golden = await apiList(page, 'q=Golden&pageSize=9')
  expect(golden.total).toBeGreaterThan(0)
  expect(golden.total).toBeLessThan(36)
  await expectListMatchesApi(page)
  for (const name of await cardNames(page)) expect(name).toContain('Golden')

  await searchFor(page, isMobile, '')
  await expect.poll(() => urlParam(page, 'q')).toBeNull()
  await expect(cardsOf(page)).toHaveCount(9)
  await expectListMatchesApi(page)
})

test('2. filtros combinados (coleção + rede + preço) batem com a API e reiniciam page=1', async ({
  page,
  isMobile,
}) => {
  test.slow() // dezenas de teclas nos sliders; sob carga paralela passa dos 30 s
  const all = await apiAll(page)
  // Um NFT de preço médio garante que a combinação coleção + rede + faixa não fica vazia.
  const target = all.items.find((nft) => Number(nft.price) >= 1 && Number(nft.price) <= 3)
  if (!target) throw new Error('Nenhum NFT entre 1 e 3 ETH no seed')
  const collection = all.facets.collections.find((f) => f.id === target.collection)!.name
  const network = all.facets.networks.find((f) => f.id === target.network)!.name
  const price = { min: 0.22, max: 9.3 }

  await page.goto('/?page=2')
  await expect(paginationOf(page).getByRole('link', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')

  await applyFilters(page, isMobile, { collection, network, price })

  await expect.poll(() => urlParam(page, 'collections')).toEqual([target.collection])
  await expect.poll(() => urlParam(page, 'networks')).toEqual([target.network])
  await expect.poll(() => Number(urlParam(page, 'priceMin'))).toBeGreaterThan(0)
  await expect.poll(() => Number(urlParam(page, 'priceMax'))).toBeGreaterThan(0)
  expect(urlParam(page, 'page')).toBeNull()

  const expected = await apiList(page, apiParamsFromUrl(page))
  expect(expected.items.map((n) => n.id)).toContain(target.id)
  await expectListMatchesApi(page)
  await expect(cardsOf(page)).toHaveCount(expected.items.length)
})

for (const [label, filters] of [
  ['coleção', { collection: 'Música' }],
  ['rede', { network: 'Polygon' }],
  ['faixa de preço', { price: { min: 0.22 } }],
] as const satisfies readonly [string, Filters][]) {
  test(`2b. mudar ${label} reinicia a página para 1`, async ({ page, isMobile }) => {
    await page.goto('/?page=2')
    await expect(paginationOf(page).getByRole('link', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
    expect(urlParam(page, 'page')).toBe(2)

    await applyFilters(page, isMobile, filters)

    // page=1 é o padrão e some da URL.
    await expect.poll(() => urlParam(page, 'page')).toBeNull()
    await expectListMatchesApi(page)
    const links = paginationOf(page).getByRole('link', { name: 'Página 2' })
    if ((await links.count()) > 0) {
      await expect(paginationOf(page).getByRole('link', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page')
    }
  })
}

test('3. ordenação por preço crescente e decrescente', async ({ page }) => {
  const all = (await apiAll(page)).items.map((nft) => Number(nft.price))

  await chooseSort(page, 'Menor preço')
  await expect.poll(() => urlParam(page, 'sort')).toBe('price_asc')
  await expectListMatchesApi(page)
  const ascending = await cardPrices(page)
  expect(ascending).toEqual([...ascending].sort((a, b) => a - b))
  expect(ascending[0]).toBe(Math.min(...all))

  await chooseSort(page, 'Maior preço')
  await expect.poll(() => urlParam(page, 'sort')).toBe('price_desc')
  await expectListMatchesApi(page)
  const descending = await cardPrices(page)
  expect(descending).toEqual([...descending].sort((a, b) => b - a))
  expect(descending[0]).toBe(Math.max(...all))
})

test('4. paginação: páginas 2 e 3, aria-current, itens mudam e total de páginas bate com a API', async ({ page }) => {
  const api = await apiList(page, 'pageSize=9')
  expect(api.totalPages).toBeGreaterThanOrEqual(3)

  const nav = paginationOf(page)
  const pageLinks = nav.getByRole('link', { name: /^Página \d+$/ })
  await expect(pageLinks).toHaveCount(api.totalPages)
  await expect(pageLinks.last()).toHaveText(String(api.totalPages))
  await expect(nav.getByRole('link', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page')

  let previous = await cardIds(page)
  for (const target of [2, 3]) {
    await nav.getByRole('link', { name: `Página ${target}` }).click()
    await expect.poll(() => urlParam(page, 'page')).toBe(target)
    await expect(nav.getByRole('link', { name: `Página ${target}` })).toHaveAttribute('aria-current', 'page')
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1)
    await expectListMatchesApi(page)
    const ids = await cardIds(page)
    expect(ids.some((id) => previous.includes(id))).toBe(false)
    previous = ids
  }
})

test('5. filtros + página 2 sobrevivem ao F5 e ao voltar/avançar no histórico', async ({ page, isMobile }) => {
  const all = await apiAll(page)
  const biggest = [...all.facets.networks].sort((a, b) => b.count - a.count)[0]!
  expect(biggest.count).toBeGreaterThan(9)

  const filtersLabel = page.getByRole('button', { name: /^Filtros/ })
  const readState = async () => ({
    search: new URL(page.url()).search,
    ids: await cardIds(page),
    sort: await sortTrigger(page).innerText(),
    current: await paginationOf(page).locator('[aria-current="page"]').innerText(),
    filters: isMobile
      ? await filtersLabel.textContent()
      : await page
          .getByRole('complementary', { name: 'Filtros' })
          .getByRole('checkbox')
          .evaluateAll((boxes) => boxes.map((box) => box.getAttribute('aria-checked'))),
  })
  const expectState = (expected: Awaited<ReturnType<typeof readState>>) =>
    expect(async () => expect(await readState()).toEqual(expected)).toPass()

  await applyFilters(page, isMobile, { network: biggest.name })
  await expect.poll(() => urlParam(page, 'networks')).toEqual([biggest.id])
  await chooseSort(page, 'Menor preço')
  await expect.poll(() => urlParam(page, 'sort')).toBe('price_asc')
  await expectListMatchesApi(page)

  const nav = paginationOf(page)
  await expect(nav.getByRole('link', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page')
  const firstPage = await readState()

  await nav.getByRole('link', { name: 'Página 2' }).click()
  await expect.poll(() => urlParam(page, 'page')).toBe(2)
  await expect(nav.getByRole('link', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
  await expectListMatchesApi(page)
  const secondPage = await readState()
  expect(secondPage.ids).not.toEqual(firstPage.ids)

  await page.reload()
  await expectState(secondPage)

  await page.goBack()
  await expectState(firstPage)
  await expectListMatchesApi(page)

  await page.goForward()
  await expectState(secondPage)
  await expectListMatchesApi(page)
})

test('6. estado vazio com "Limpar filtros" e restauração da lista', async ({ page }) => {
  await page.goto('/?q=xxxxxxxx')
  const catalog = catalogOf(page)
  await expect(catalog.getByText('Nenhum NFT encontrado.')).toBeVisible()
  await expect(cardsOf(page)).toHaveCount(0)
  await expect(totalText(page)).toHaveText('0 NFTs')

  await catalog.getByRole('button', { name: 'Limpar filtros' }).click()
  await expect.poll(() => urlParam(page, 'q')).toBeNull()
  await expect(cardsOf(page)).toHaveCount(9)
  await expect(catalog.getByText('Nenhum NFT encontrado.')).toHaveCount(0)
  await expectListMatchesApi(page)
})

test('7. falha do servidor mostra o aviso e "Tentar de novo" recupera sem recarregar', async ({ page }) => {
  // Todas as chamadas de GET /api/nfts falham até o cenário voltar ao normal.
  await setScenario(page, 'server-error', { failures: 1000 })
  await page.goto('/')
  await page.evaluate(() => {
    ;(window as unknown as { __kept: boolean }).__kept = true
  })

  const alert = catalogOf(page).getByRole('alert')
  await expect(alert).toBeVisible()
  await expect(alert).toContainText('Não foi possível carregar os NFTs.')
  await expect(cardsOf(page)).toHaveCount(0)

  await setScenario(page, 'default')
  await alert.getByRole('button', { name: 'Tentar de novo' }).click()

  await expect(cardsOf(page)).toHaveCount(9)
  await expect(catalogOf(page).getByRole('alert')).toHaveCount(0)
  // Sem recarregar: a marca colocada na página ainda existe.
  expect(await page.evaluate(() => (window as unknown as { __kept?: boolean }).__kept)).toBe(true)
  await expectListMatchesApi(page)
})

const SLOW_SEED = 4
const FAST_SEED = 5

test('8. respostas fora de ordem: a tela mostra só o último termo', async ({ page, isMobile }) => {
  // No cenário jitter a latência quase não varia entre requisições da MESMA seed (o hash só muda no
  // último caractere), então duas buscas seguidas não se invertem sozinhas. Para forçar a inversão
  // usa-se o próprio cenário: a 1ª busca sai com uma seed lenta (~2,4 s) e a 2ª com uma rápida
  // (~0,2 s). O teste confere abaixo que a busca antiga não concluiu antes da nova.
  await setScenario(page, 'jitter', { seed: SLOW_SEED })

  const log: string[] = []
  const termOf = (url: string) => {
    const { pathname, searchParams } = new URL(url)
    return pathname === '/api/nfts' ? searchParams.get('q') : null
  }
  page.on('request', (r) => {
    const term = termOf(r.url())
    if (term) log.push(`start:${term}`)
  })
  page.on('requestfinished', (r) => {
    const term = termOf(r.url())
    if (term) log.push(`finished:${term}`)
  })
  // O app cancela (AbortSignal) a busca abandonada: ela aparece como falha de rede, não como resposta.
  page.on('requestfailed', (r) => {
    const term = termOf(r.url())
    if (term) log.push(`cancelled:${term}`)
  })

  await searchFor(page, isMobile, 'Golden')
  await expect.poll(() => log).toContain('start:Golden')
  await setScenario(page, 'jitter', { seed: FAST_SEED })
  await searchFor(page, isMobile, 'Violet')
  await expect.poll(() => log).toContain('start:Violet')

  // A busca antiga ainda estava em andamento quando a nova saiu: nunca concluiu antes dela.
  await expect.poll(() => log).toContain('finished:Violet')
  expect(log.slice(0, log.indexOf('start:Violet'))).not.toContain('finished:Golden')

  // Barreira por evento (sem sleep): uma requisição lenta feita agora só termina depois do ponto em
  // que a resposta antiga (seed lenta) teria chegado, caso ela ainda estivesse viva.
  await setScenario(page, 'jitter', { seed: SLOW_SEED })
  await page.evaluate(async () => (await fetch('/api/nfts?pageSize=1')).json())

  // Depois de tudo assentar, só o último termo aparece.
  await setScenario(page, 'default')
  await expect.poll(() => urlParam(page, 'q')).toBe('Violet')
  const violet = await apiList(page, 'q=Violet&pageSize=9')
  await expect.poll(() => cardIds(page)).toEqual(violet.items.map((item) => item.id))
  for (const name of await cardNames(page)) expect(name).toContain('Violet')
  await expect(totalText(page)).toHaveText(`${violet.total} ${violet.total === 1 ? 'NFT' : 'NFTs'}`)
})

test('9. skeletons com as dimensões dos cards durante o carregamento lento', async ({ page }) => {
  await setScenario(page, 'slow', { latencyMs: 2_000 })
  await page.goto('/')

  const catalog = catalogOf(page)
  // Só a grade do painel da aba: a sidebar também tem skeletons (das facets).
  const skeletons = catalog.getByRole('tabpanel').getByRole('listitem', { includeHidden: true })
  await expect(skeletons).toHaveCount(9)
  await expect(cardsOf(page)).toHaveCount(0)

  const skeletonGrid = skeletons.first().locator('..')
  const skeletonGridHandle = await skeletonGrid.elementHandle()
  const skeletonItem = await skeletons.first().boundingBox()
  const skeletonBox = await skeletonGrid.boundingBox()
  expect(skeletonBox).not.toBeNull()

  // O conteúdo substitui os skeletons.
  await expect(cardsOf(page)).toHaveCount(9)
  await expect.poll(() => skeletonGridHandle!.evaluate((grid) => grid.isConnected)).toBe(false)

  const realGrid = cardsOf(page).first().locator('..')
  const realItem = await cardsOf(page).first().boundingBox()
  const realBox = await realGrid.boundingBox()

  expect(Math.abs(realBox!.height - skeletonBox!.height), 'altura da grade').toBeLessThanOrEqual(8)
  expect(Math.abs(realBox!.width - skeletonBox!.width), 'largura da grade').toBeLessThanOrEqual(1)
  expect(Math.abs(realItem!.height - skeletonItem!.height), 'altura do card').toBeLessThanOrEqual(8)
  expect(Math.abs(realItem!.width - skeletonItem!.width), 'largura do card').toBeLessThanOrEqual(1)
})

test('10. detalhe: acesso direto, NFT inexistente e clique no card', async ({ page }) => {
  // Acesso direto a um NFT do seed.
  const direct = await apiNft(page, 'nft_007')
  await page.goto(`/nft/${direct.id}`)
  await expect(page.getByRole('heading', { level: 1, name: direct.name })).toBeVisible()
  await expect(page.getByText(`${formatEth(direct.price)} ETH`).first()).toBeVisible()
  for (const edition of direct.editions) {
    await expect(
      page.getByRole('radio', { name: new RegExp(`^${escapeRegExp(edition.name)}(\\s|$)`) }),
    ).toHaveCount(1)
  }

  // NFT inexistente: página de erro com saída.
  await page.goto('/nft/inexistente')
  await expect(page.getByRole('heading', { level: 1, name: 'NFT não encontrado' })).toBeVisible()
  // O app renderiza <a href="/" role="button"> (Button com render={<Link/>}); o papel exposto é "button".
  await page.getByRole('button', { name: 'Voltar ao início' }).click()
  await expect(page).toHaveURL((url) => url.pathname === '/')
  await expect(cardsOf(page)).toHaveCount(9)

  // Clicar num card leva ao detalhe correto.
  const ids = await cardIds(page)
  const names = await cardNames(page)
  const index = 2
  await cardsOf(page).nth(index).getByRole('link').first().click()
  await expect(page).toHaveURL((url) => url.pathname === `/nft/${ids[index]}`)
  await expect(page.getByRole('heading', { level: 1, name: names[index] })).toBeVisible()
  const shown = await apiNft(page, ids[index]!)
  await expect(page.getByText(`${formatEth(shown.price)} ETH`).first()).toBeVisible()
})

test('11. edição esgotada desabilitada e limite de quantidade no estoque', async ({ page }) => {
  // nft_005 tem estoque folgado: esgota a edição 1/1 e deixa só 2 unidades na 1/10 (limite por pedido: 5).
  await page.evaluate(() => {
    window.__mocks!.setEditionAvailable('nft_005', 'nft_005_ed1', 0)
    window.__mocks!.setEditionAvailable('nft_005', 'nft_005_ed2', 2)
  })
  const nft = await apiNft(page, 'nft_005')
  expect(nft.editions.find((e) => e.name === '1/1')?.available).toBe(0)
  expect(nft.editions.find((e) => e.name === '1/10')).toMatchObject({ available: 2, maxPerOrder: 5 })

  await page.goto('/nft/nft_005')
  await expect(page.getByRole('heading', { level: 1, name: nft.name })).toBeVisible()

  // Esgotada: desabilitada e rotulada.
  const soldOut = page.getByRole('radio', { name: /^1\/1\s+Esgotada$/ })
  await expect(soldOut).toBeDisabled()
  await expect(page.getByText('Esgotada', { exact: true })).toBeVisible()
  // A edição disponível é a escolhida por padrão.
  await expect(page.getByRole('radio', { name: '1/10', exact: true })).toBeChecked()

  // O stepper para no estoque (2) e avisa de forma acessível.
  const quantity = page.getByRole('group', { name: 'Quantidade' })
  const increase = page.getByRole('button', { name: 'Aumentar quantidade' })
  const limit = page.getByRole('status').filter({ hasText: 'Limite de 2 unidades' })
  await expect(limit).toHaveCount(0)
  await expect(increase).toBeEnabled()

  await increase.click()
  await expect(quantity).toContainText('2')
  await expect(limit).toBeVisible()
  await expect(increase).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Diminuir quantidade' })).toBeEnabled()

  await page.getByRole('button', { name: 'Diminuir quantidade' }).click()
  await expect(quantity).toContainText('1')
  await expect(limit).toHaveCount(0)
  await expect(increase).toBeEnabled()
})
