import type { Locator, Page } from '@playwright/test'
import {
  auditImages,
  apiNfts,
  expectDescribedError,
  expectImagesAccessible,
  expectModalBehavior,
  expectNamedControls,
  expectRequiredMarked,
  focusIndicatorOf,
  tabThrough,
  wasReached,
} from './a11y-helpers'
import { exactLabel, openCollectorForm, signIn } from './account-helpers'
import { ANA_CART, ANA_ITEMS, INVALID_ADDRESS, INVALID_EMAIL, totalsOf } from './data'
import { emitNftUpdate, expect, test, useClock } from './fixtures'
import { diagnostics } from './resilience-helpers'
import { chooseWallet, confirmButton, connectWallet, expectCartSummary, reviewDialog } from './shop-helpers'

/**
 * Acessibilidade (docs/SPEC.md, seções 8 e 9). Observa a interface pela árvore de acessibilidade
 * e por atributos; nada de seletor por classe, exceto onde o atributo é o próprio objeto do teste.
 */

test.describe.configure({ timeout: 60_000 })

const catalog = (page: Page) => page.getByRole('region', { name: 'Catálogo de NFTs' })
const cards = (page: Page) =>
  catalog(page).getByRole('listitem').filter({ has: page.getByRole('link', { name: /^Ver / }) })
const accountMenu = (page: Page) => page.getByRole('button', { name: /^Menu da conta de / })
const field = (page: Page, label: string) => page.getByLabel(exactLabel(label))

async function waitForCatalog(page: Page) {
  await expect(cards(page)).toHaveCount(9)
}

/** Falhas de foco, em texto legível, ou lista vazia. */
const focusProblems = (stops: Awaited<ReturnType<typeof tabThrough>>) =>
  stops.filter((s) => !s.ok).map((s) => `#${s.index} ${s.label}: ${s.detail} (contraste ${s.contrast})`)

// ---------------------------------------------------------------------------
// 1. Teclado no catálogo
// ---------------------------------------------------------------------------

test('1a. o primeiro Tab leva ao link "Ir para o conteúdo" e Enter move o foco para o main', async ({ page }) => {
  await waitForCatalog(page)
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Ir para o conteúdo' })
  await expect(skip).toBeFocused()
  // Só aparece quando focado, e com indicador de foco.
  await expect(skip).toBeInViewport()
  expect((await focusIndicatorOf(skip)).ok).toBe(true)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
})

test('1b. Tab percorre nav, busca, carrinho, abas, filtros, ordenação, cards e paginação, todos com foco visível', async ({
  page,
  isMobile,
}) => {
  await waitForCatalog(page)
  const next = page.getByRole('navigation', { name: 'Paginação' }).getByRole('link', { name: 'Próxima página' })
  const bottomNav = page.getByRole('navigation', { name: 'Navegação principal' })
  const stops = await tabThrough(page, {
    max: 260,
    until: isMobile ? bottomNav.getByRole('link', { name: 'Perfil' }) : next,
  })

  const expected: Record<string, Locator> = isMobile
    ? {
        busca: page.getByRole('searchbox', { name: 'Explorar coleções' }),
        filtros: page.getByRole('button', { name: /^Filtros/ }),
        abas: page.getByRole('tab', { name: 'Todos os NFTs' }),
        ordenação: page.getByRole('combobox', { name: /Ordenar por/ }),
        card: cards(page).first().getByRole('link').first(),
        favoritar: cards(page).first().getByRole('button', { name: /^Favoritar / }),
        paginação: page.getByRole('navigation', { name: 'Paginação' }).getByRole('link', { name: 'Página 1' }),
        'barra inferior (início)': bottomNav.getByRole('link', { name: 'Início' }),
        'barra inferior (carrinho)': bottomNav.getByRole('link', { name: /^Carrinho/ }),
        'barra inferior (perfil)': bottomNav.getByRole('link', { name: 'Perfil' }),
      }
    : {
        'nav: início': page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Início' }),
        'nav: mercado': page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Mercado' }),
        busca: page.getByRole('button', { name: 'Buscar', exact: true }),
        carrinho: page.getByRole('banner').getByRole('link', { name: /^Carrinho/ }),
        entrar: page.getByRole('banner').getByRole('link', { name: 'Entrar' }),
        'filtro (coleção)': page.getByRole('complementary', { name: 'Filtros' }).getByRole('checkbox').first(),
        'filtro (preço)': page.getByRole('slider', { name: 'Preço mínimo' }),
        abas: page.getByRole('tab', { name: 'Todos os NFTs' }),
        ordenação: page.getByRole('combobox', { name: /Ordenar por/ }),
        card: cards(page).first().getByRole('link').first(),
        favoritar: cards(page).first().getByRole('button', { name: /^Favoritar / }),
        paginação: page.getByRole('navigation', { name: 'Paginação' }).getByRole('link', { name: 'Página 1' }),
      }

  for (const [name, locator] of Object.entries(expected)) {
    expect(await wasReached(locator), `Tab não chegou a: ${name}`).toBe(true)
  }
  expect(focusProblems(stops), 'paradas sem indicador de foco visível com contraste >= 3:1').toEqual([])
})

// ---------------------------------------------------------------------------
// 2. Menu da conta
// ---------------------------------------------------------------------------

test.describe('2. menu da conta (desktop)', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'No mobile não há menu da conta: Perfil fica na barra inferior.')
  })

  const focusedItem = (page: Page) =>
    page.evaluate(() => document.activeElement?.getAttribute('role') === 'menuitem' ? document.activeElement.textContent?.trim() : null)

  for (const key of ['Enter', 'Space'] as const) {
    test(`abre com ${key}, navega com setas e Esc fecha devolvendo o foco ao botão`, async ({ page }) => {
      await signIn(page, 'ana', '/')
      const trigger = accountMenu(page)
      await trigger.focus()
      await page.keyboard.press(key)
      const menu = page.getByRole('menu')
      await expect(menu).toBeVisible()
      await expect(trigger).toHaveAttribute('aria-expanded', 'true')

      // O foco entra no menu, no primeiro item; as setas percorrem os itens.
      await expect.poll(() => focusedItem(page)).toBe('Perfil')
      await page.keyboard.press('ArrowDown')
      await expect.poll(() => focusedItem(page)).toBe('Carteiras')
      await page.keyboard.press('ArrowDown')
      await expect.poll(() => focusedItem(page)).toBe('Sair')
      await page.keyboard.press('ArrowUp')
      await expect.poll(() => focusedItem(page)).toBe('Carteiras')

      await page.keyboard.press('Escape')
      await expect(menu).toBeHidden()
      await expect(trigger).toBeFocused()
      await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })
  }
})

// ---------------------------------------------------------------------------
// 3. Diálogos e drawers
// ---------------------------------------------------------------------------

test('3a. Sheet de filtros (mobile): foco, trava de Tab, fundo inerte, Esc e retorno do foco', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'O Sheet de filtros só existe abaixo de 1024 px.')
  await waitForCatalog(page)
  const trigger = page.getByRole('button', { name: /^Filtros/ })
  await expectModalBehavior(page, {
    trigger,
    dialog: page.getByRole('dialog', { name: 'Filtros' }),
    open: () => page.keyboard.press('Enter'),
  })
})

test('3b. Dialog de zoom da imagem no detalhe', async ({ page }) => {
  await page.goto(`/nft/${ANA_ITEMS.emerald.nftId}`)
  await expect(page.getByRole('heading', { level: 1, name: ANA_ITEMS.emerald.name })).toBeVisible()
  await expectModalBehavior(page, {
    trigger: page.getByRole('button', { name: 'Ampliar imagem' }),
    dialog: page.getByRole('dialog', { name: /imagem ampliada/ }),
    open: () => page.keyboard.press('Enter'),
  })
})

test('3c. Dialog de revisão do checkout', async ({ page, isMobile }) => {
  await signIn(page, 'ana', '/checkout')
  await page.getByRole('heading', { level: 1, name: 'Pagamento' }).waitFor()
  await openCollectorForm(page, isMobile)
  await expect(field(page, 'E-mail')).not.toHaveValue('')
  await chooseWallet(page, 'Principal')
  await connectWallet(page)
  await expect(confirmButton(page)).toBeEnabled()
  await expectModalBehavior(page, {
    trigger: confirmButton(page),
    dialog: reviewDialog(page),
    open: () => page.keyboard.press('Enter'),
  })
})

test('3d. Diálogo de dados não salvos do perfil', async ({ page }) => {
  await signIn(page, 'ana', '/profile')
  await expect(field(page, 'Nome de exibição')).not.toHaveValue('')
  await field(page, 'Nome de exibição').fill('Ana Souza Silva')
  const link = page
    .getByRole('navigation', { name: 'Meu perfil' })
    .getByRole('link', { name: 'Carteiras' })
  await expectModalBehavior(page, {
    trigger: link,
    dialog: page.getByRole('dialog', { name: 'Descartar alterações?' }),
    open: () => page.keyboard.press('Enter'),
  })
  // Continua na tela, com o rascunho intacto.
  await expect(page).toHaveURL(/\/profile$/)
  await expect(field(page, 'Nome de exibição')).toHaveValue('Ana Souza Silva')
})

// ---------------------------------------------------------------------------
// 4. Formulários
// ---------------------------------------------------------------------------

/** Envia o formulário vazio/inválido e confere erro associado e foco no primeiro inválido. */
async function expectInvalidSubmit(
  page: Page,
  { submit, firstInvalid, invalid }: { submit: Locator; firstInvalid: Locator; invalid: Locator[] },
) {
  // Pelo teclado: tirar o foco do último campo valida e pode mover o botão; Enter no botão
  // focado não depende de onde o ponteiro estaria.
  await submit.focus()
  await page.keyboard.press('Enter')
  for (const control of invalid) {
    const text = await expectDescribedError(control)
    // O erro é texto visível (não só a cor da borda).
    await expect(page.getByText(text, { exact: true }).first()).toBeVisible()
  }
  await expect(firstInvalid).toBeFocused()
}

test('4a. login: nomes acessíveis, obrigatórios, erro associado e foco no primeiro inválido', async ({ page }) => {
  await page.goto('/login')
  const email = field(page, 'E-mail')
  const password = field(page, 'Senha')
  await expect(email).toBeVisible()
  await expectNamedControls(page.getByRole(page.viewportSize()!.width >= 768 ? 'dialog' : 'main'))
  await expectRequiredMarked(email)
  await expectRequiredMarked(password)
  await expectInvalidSubmit(page, {
    submit: page.getByRole('button', { name: 'Entrar' }),
    firstInvalid: email,
    invalid: [email, password],
  })
})

test('4b. cadastro: nomes acessíveis, obrigatórios, erro associado e foco no primeiro inválido', async ({ page }) => {
  await page.goto('/signup')
  const name = page.getByLabel('Nome de usuário')
  await expect(name).toBeVisible()
  await expectNamedControls(page.getByRole(page.viewportSize()!.width >= 768 ? 'dialog' : 'main'))
  for (const label of ['E-mail', 'Senha']) await expectRequiredMarked(field(page, label))
  await expectRequiredMarked(name)
  await expectInvalidSubmit(page, {
    submit: page.getByRole('button', { name: /^Criar (conta|perfil)$/ }),
    firstInvalid: name,
    invalid: [name, field(page, 'E-mail'), field(page, 'Senha')],
  })
})

test('4c. checkout: nomes acessíveis, obrigatórios, erro associado e foco no primeiro inválido', async ({
  page,
  isMobile,
}) => {
  await signIn(page, 'ana', '/checkout')
  await openCollectorForm(page, isMobile)
  await expect(field(page, 'E-mail')).not.toHaveValue('')
  await expectNamedControls(page.getByRole('main'))
  await expectRequiredMarked(field(page, 'Nome de exibição'))
  await expectRequiredMarked(field(page, 'E-mail'))

  await field(page, 'Nome de exibição').fill('')
  await field(page, 'E-mail').fill(INVALID_EMAIL)
  await field(page, 'Endereço da carteira').fill(INVALID_ADDRESS)
  await expectInvalidSubmit(page, {
    submit: page.getByRole('button', { name: 'Revisar dados' }),
    firstInvalid: field(page, 'Nome de exibição'),
    invalid: [field(page, 'Nome de exibição'), field(page, 'E-mail'), field(page, 'Endereço da carteira')],
  })
})

test('4d. perfil: nomes acessíveis, obrigatórios, erro associado e foco no primeiro inválido', async ({ page }) => {
  await signIn(page, 'ana', '/profile')
  await expect(field(page, 'Nome de exibição')).not.toHaveValue('')
  await expectNamedControls(page.getByRole('main'))
  await expectRequiredMarked(field(page, 'Nome de exibição'))
  await expectRequiredMarked(field(page, 'E-mail'))

  await field(page, 'Nome de exibição').fill('')
  await field(page, 'E-mail').fill(INVALID_EMAIL)
  await expectInvalidSubmit(page, {
    submit: page.getByRole('button', { name: 'Salvar', exact: true }),
    firstInvalid: field(page, 'Nome de exibição'),
    invalid: [field(page, 'Nome de exibição'), field(page, 'E-mail')],
  })
})

test('4e. carteiras: nomes acessíveis, obrigatórios, erro associado e foco no primeiro inválido', async ({ page }) => {
  await signIn(page, 'ana', '/wallets')
  const primary = page.getByRole('region', { name: 'Carteira principal' })
  const inPrimary = (label: string) => primary.getByLabel(exactLabel(label))
  await expect(inPrimary('Endereço da carteira')).not.toHaveValue('')
  await expectNamedControls(primary)
  await expectRequiredMarked(inPrimary('Nome do perfil'))
  await expectRequiredMarked(inPrimary('Endereço da carteira'))

  await inPrimary('Nome do perfil').fill('')
  await inPrimary('Endereço da carteira').fill(INVALID_ADDRESS)
  await expectInvalidSubmit(page, {
    submit: primary.getByRole('button', { name: 'Salvar carteira' }),
    firstInvalid: inPrimary('Nome do perfil'),
    invalid: [inPrimary('Nome do perfil'), inPrimary('Endereço da carteira')],
  })
})

// ---------------------------------------------------------------------------
// 5. Imagens
// ---------------------------------------------------------------------------

test('5. imagens: alt em todas, significativo nas de NFT, galeria e avatar; decorativas com alt vazio', async ({
  page,
  isMobile,
}) => {
  // Início: cards e hero.
  await waitForCatalog(page)
  await expectImagesAccessible(page, 'início')
  for (const img of await cards(page).locator('img').all()) {
    await expect(img).toHaveAttribute('alt', /\S/)
  }

  // Detalhe: imagem principal e miniaturas.
  await page.goto(`/nft/${ANA_ITEMS.emerald.nftId}`)
  await expect(page.getByRole('heading', { level: 1, name: ANA_ITEMS.emerald.name })).toBeVisible()
  await expectImagesAccessible(page, 'detalhe')
  if (!isMobile) {
    const thumbs = page.getByRole('list', { name: 'Imagens do NFT' }).locator('img')
    expect(await thumbs.count()).toBeGreaterThan(0)
    for (const img of await thumbs.all()) await expect(img).toHaveAttribute('alt', /\S/)
  }

  // Carrinho da Ana: imagem de cada item.
  await signIn(page, 'ana', '/cart')
  await expect(page.getByRole('list', { name: 'Itens do carrinho' }).getByRole('listitem')).toHaveCount(3)
  await expectImagesAccessible(page, 'carrinho')

  // Avatar: sem imagem é role="img" com nome; depois do envio a <img> tem alt com o nome.
  await page.goto('/profile')
  await expect(page.getByRole('img', { name: 'Avatar padrão' })).toBeVisible()
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  )
  await page.locator('input[type="file"]').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByRole('img', { name: /^Avatar de / })).toBeVisible()
  const report = await auditImages(page)
  expect(report.filter((r) => r.problem)).toEqual([])
})

// ---------------------------------------------------------------------------
// 6. Estrutura
// ---------------------------------------------------------------------------

const PUBLIC_PAGES = [
  { path: '/', name: 'início' },
  { path: `/nft/${ANA_ITEMS.emerald.nftId}`, name: 'detalhe' },
  { path: '/cart', name: 'carrinho' },
  { path: '/login', name: 'login' },
  { path: '/signup', name: 'cadastro' },
]
const PRIVATE_PAGES = [
  { path: '/checkout', name: 'checkout' },
  { path: '/profile', name: 'perfil' },
  { path: '/wallets', name: 'carteiras' },
  { path: '/favorites', name: 'favoritos' },
]

async function expectStructure(page: Page, name: string, isMobile: boolean, path: string) {
  await page.goto(path)
  const modal = !isMobile && (path === '/login' || path === '/signup')
  // Em /login e /signup no desktop a página é um diálogo modal: o resto fica fora da árvore de
  // acessibilidade (por isso não há main), e o h1 é o título do diálogo.
  if (!modal) await expect(page.getByRole('main')).toHaveCount(1)
  else await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(page.getByRole('heading', { level: 1 }), `${name}: exatamente um h1`).toHaveCount(1)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  // Header e rodapé só existem no layout desktop; a barra inferior é a navegação do mobile.
  // Em /login e /signup no desktop o diálogo modal deixa o resto da página inerte.
  if (!isMobile && !modal) {
    await expect(page.getByRole('banner'), `${name}: header`).toHaveCount(1)
    await expect(page.getByRole('navigation', { name: 'Principal' }), `${name}: nav`).toHaveCount(1)
    await expect(page.getByRole('contentinfo'), `${name}: footer`).toHaveCount(1)
  }
  if (isMobile && /^\/($|favorites|profile|wallets)/.test(path)) {
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toHaveCount(1)
  }
}

test('6a. html lang pt-BR; um h1 por página; landmarks; título não vazio e distinto em cada página', async ({
  page,
  isMobile,
}) => {
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
  const titles = new Map<string, string>()

  for (const { path, name } of PUBLIC_PAGES) {
    await expectStructure(page, name, isMobile, path)
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
    titles.set(name, await page.title())
  }
  await signIn(page, 'ana')
  for (const { path, name } of PRIVATE_PAGES) {
    await expectStructure(page, name, isMobile, path)
    titles.set(name, await page.title())
  }

  for (const [name, title] of titles) expect(title.trim(), `título de ${name}`).not.toBe('')
  const wanted = ['início', 'detalhe', 'carrinho', 'login', 'checkout', 'perfil', 'carteiras']
  const values = wanted.map((n) => titles.get(n)!)
  expect(new Set(values).size, `títulos repetidos: ${JSON.stringify(Object.fromEntries(titles))}`).toBe(values.length)
})

test('6b. abas com role=tab e aria-selected; paginação com aria-current na página atual', async ({ page }) => {
  await waitForCatalog(page)
  const tabs = page.getByRole('tablist', { name: 'Tipo de listagem' }).getByRole('tab')
  await expect(tabs).toHaveCount(3)
  await expect(page.getByRole('tab', { selected: true })).toHaveCount(1)
  await expect(page.getByRole('tab', { name: 'Todos os NFTs' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: 'Em alta' }).click()
  await expect(page.getByRole('tab', { name: 'Em alta' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tab', { name: 'Todos os NFTs' })).toHaveAttribute('aria-selected', 'false')
  await page.getByRole('tab', { name: 'Todos os NFTs' }).click()
  await waitForCatalog(page)

  const pagination = page.getByRole('navigation', { name: 'Paginação' })
  await expect(pagination.locator('[aria-current="page"]')).toHaveCount(1)
  await expect(pagination.getByRole('link', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page')
  await pagination.getByRole('link', { name: 'Página 2' }).click()
  await expect(pagination.getByRole('link', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
  await expect(pagination.getByRole('link', { name: 'Página 1' })).not.toHaveAttribute('aria-current', 'page')

  // Abas do detalhe.
  await page.goto(`/nft/${ANA_ITEMS.emerald.nftId}`)
  await expect(page.getByRole('tab', { name: 'Detalhes do NFT' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: /^Avaliações/ }).click()
  await expect(page.getByRole('tab', { name: /^Avaliações/ })).toHaveAttribute('aria-selected', 'true')
})

// ---------------------------------------------------------------------------
// 7. Estados sem depender de cor
// ---------------------------------------------------------------------------

test('7a. edição esgotada tem o texto "Esgotada" e o radio fica desabilitado', async ({ page }) => {
  const [nft] = await apiNfts(page)
  const edition = nft.editions[0]
  await page.evaluate(([n, e]) => window.__mocks!.setEditionAvailable(n, e, 0), [nft.id, edition.id] as const)
  await page.goto(`/nft/${nft.id}`)
  const group = page.getByRole('radiogroup', { name: 'Edição:' })
  // O texto "Esgotada" faz parte do nome acessível da edição, não só de uma cor ou de um risco.
  const radio = group.getByRole('radio', { name: new RegExp(`^${edition.name} Esgotada$`) })
  await expect(radio).toBeDisabled()
  await expect(group.getByText('Esgotada')).toBeVisible()
})

test('7b. item com preço alterado no carrinho tem aviso em texto', async ({ page }) => {
  await signIn(page, 'ana', '/cart')
  await expect(page.getByRole('list', { name: 'Itens do carrinho' }).getByRole('listitem')).toHaveCount(3)
  // A cotação inicial já chegou: o aviso compara com ela.
  await expectCartSummary(page, totalsOf(ANA_CART))
  const notice = page.getByRole('status').filter({ hasText: 'Seu carrinho mudou' })
  await expect(notice).toHaveCount(0)
  await expect.poll(async () => (await diagnostics(page)).status).toBe('connected')
  await emitNftUpdate(page, { nftId: ANA_ITEMS.emerald.nftId, price: '9.5' })
  await expect(notice).toContainText(`${ANA_ITEMS.emerald.name}: o preço`)
  await expect(notice).toContainText('para 9.50 ETH')
})

test('7c. erro de campo tem texto e favorito tem aria-pressed', async ({ page }) => {
  // Erro em texto: a mensagem existe e é visível, ligada ao campo (4a confere a associação).
  await page.goto('/login')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText(/obrigatório|informe|inválid/i).first()).toBeVisible()

  await signIn(page, 'ana', '/')
  await waitForCatalog(page)
  const first = cards(page).first()
  const heart = first.getByRole('button', { name: /^Favoritar / })
  await expect(heart).toHaveAttribute('aria-pressed', 'false')
  await heart.click()
  const pressed = first.getByRole('button', { name: /^Remover .* dos favoritos$/ })
  await expect(pressed).toHaveAttribute('aria-pressed', 'true')
})

// ---------------------------------------------------------------------------
// 8. Feedback acessível
// ---------------------------------------------------------------------------

/**
 * O texto aparece dentro de um elemento role=status/alert que, por sua vez, está numa região
 * aria-live já existente antes da ação (marcada com data-live-before).
 */
async function markLiveRegions(page: Page) {
  const found = await page.evaluate(() => {
    const regions = [...document.querySelectorAll('[aria-live]')]
    regions.forEach((el) => el.setAttribute('data-live-before', ''))
    return regions.length
  })
  expect(found, 'nenhuma região aria-live no carregamento da página').toBeGreaterThan(0)
}

async function expectAnnounced(page: Page, text: string | RegExp) {
  const message = page.locator('[aria-live]').getByText(text).first()
  await expect(message).toBeVisible()
  const result = await message.evaluate((el) => ({
    role: el.closest('[role="status"], [role="alert"]')?.getAttribute('role') ?? null,
    region: !!el.closest('[data-live-before]'),
  }))
  expect(result.role, 'o aviso deveria ter role=status ou alert').toMatch(/^(status|alert)$/)
  expect(result.region, 'o aviso deveria cair numa região aria-live criada no carregamento').toBe(true)
}

test('8a. toast de sucesso (adicionar ao carrinho) cai numa região aria-live existente', async ({ page }) => {
  await waitForCatalog(page)
  await markLiveRegions(page)
  await cards(page).first().getByRole('button', { name: /^Adicionar .* ao carrinho$/ }).click()
  await expectAnnounced(page, /adicionado ao carrinho/)
})

test('8b. toast de falha de mutation (favorito) e de sucesso (perfil) ficam em região aria-live', async ({ page }) => {
  await signIn(page, 'ana', '/')
  await waitForCatalog(page)
  await markLiveRegions(page)
  await page.evaluate(() =>
    window.__mocks!.failNext({ method: 'PUT', path: '/api/favorites/', status: 500, times: 1 }),
  )
  await cards(page).first().getByRole('button', { name: /^Favoritar / }).click()
  await expectAnnounced(page, /favorit/i)

  await page.goto('/profile')
  await expect(field(page, 'Nome de exibição')).not.toHaveValue('')
  await markLiveRegions(page)
  await field(page, 'Nome de exibição').fill('Ana Souza Silva')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expectAnnounced(page, 'Perfil atualizado com sucesso')
})

test('8c. avisos em tempo real: as regiões já existem vazias no carregamento e recebem o texto depois', async ({
  page,
}) => {
  await signIn(page, 'ana', '/cart')
  await expect(page.getByRole('list', { name: 'Itens do carrinho' }).getByRole('listitem')).toHaveCount(3)
  await expectCartSummary(page, totalsOf(ANA_CART))
  await expect.poll(async () => (await diagnostics(page)).status).toBe('connected')
  await page.evaluate(() => {
    document.querySelectorAll('[role="status"]').forEach((el) => el.setAttribute('data-live-before', ''))
  })
  await emitNftUpdate(page, { nftId: ANA_ITEMS.emerald.nftId, price: '9.5' })
  const notice = page.getByRole('status').filter({ hasText: 'Seu carrinho mudou' })
  await expect(notice).toBeVisible()
  expect(await notice.evaluate((el) => el.hasAttribute('data-live-before'))).toBe(true)
})

// ---------------------------------------------------------------------------
// 9. Movimento reduzido
// ---------------------------------------------------------------------------

test.describe('9. movimento reduzido', () => {
  test.describe('com reducedMotion: reduce', () => {
    test.use({ reducedMotion: 'reduce' })

    test('9a. o skeleton-bone dos skeletons não anima', async ({ page }) => {
      await page.evaluate(() => window.__mocks!.setScenario('slow', { latencyMs: 4000 }))
      await page.reload()
      const bone = page.locator('.skeleton-bone:visible').first()
      await expect(bone).toBeVisible()
      const motion = await bone.evaluate((el) => {
        const cs = getComputedStyle(el)
        return { name: cs.animationName, duration: parseFloat(cs.animationDuration) }
      })
      expect(motion.name === 'none' || motion.duration < 0.01, JSON.stringify(motion)).toBe(true)
      const paint = await bone.evaluate((el) => ({
        clip: getComputedStyle(el).backgroundClip,
        bg: getComputedStyle(el).backgroundColor,
        page: getComputedStyle(document.body).backgroundColor,
      }))
      expect(paint.clip).not.toBe('text')
      expect(paint.bg).not.toBe(paint.page)
    })

    test('9b. o carrossel do hero não troca sozinho', async ({ page }) => {
      await useClock(page)
      await waitForCatalog(page)
      const dots = page.getByRole('group', { name: /destaque/i }).getByRole('button')
      await expect(dots.first()).toBeVisible()
      const current = () => page.getByRole('group', { name: /destaque/i }).locator('[aria-current="true"]')
      await expect(current()).toHaveAccessibleName(/1 de/)
      await page.clock.runFor(30_000)
      await expect(current()).toHaveAccessibleName(/1 de/)
    })
  })

  test.describe('controle: sem preferência por movimento reduzido', () => {
    test.use({ reducedMotion: 'no-preference' })

    test('9c. o skeleton-bone anima e o hero troca sozinho (prova que 9a e 9b medem algo)', async ({ page }) => {
      await page.evaluate(() => window.__mocks!.setScenario('slow', { latencyMs: 4000 }))
      await page.reload()
      const bone = page.locator('.skeleton-bone:visible').first()
      await expect(bone).toBeVisible()
      expect(await bone.evaluate((el) => getComputedStyle(el).animationName)).toBe('skeleton-bone')
      // Regressão: a utility `shimmer` do shadcn aplicava background-clip: text e deixava o osso invisível.
      const paint = await bone.evaluate((el) => ({
        clip: getComputedStyle(el).backgroundClip,
        bg: getComputedStyle(el).backgroundColor,
        page: getComputedStyle(document.body).backgroundColor,
      }))
      expect(paint.clip).not.toBe('text')
      expect(paint.bg).not.toBe(paint.page)

      await page.evaluate(() => window.__mocks!.setScenario('default'))
      await useClock(page)
      await waitForCatalog(page)
      const current = () => page.getByRole('group', { name: /destaque/i }).locator('[aria-current="true"]')
      await expect(current()).toHaveAccessibleName(/1 de/)
      await page.clock.runFor(7_000)
      await expect(current()).toHaveAccessibleName(/2 de/)
    })
  })
})
