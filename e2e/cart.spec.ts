import { expect, setScenario, test } from './fixtures'
import {
  ANA_CART,
  ANA_ITEMS,
  COUPON,
  DESIGN_TOTALS,
  PICKS,
  couponDiscount,
  dec,
  ethText,
  maxQuantity,
  nftByName,
  totalsOf,
  type CartExpectation,
  type Purchase,
} from './data'
import {
  apiAs,
  countRequests,
  expectFieldError,
  expectLoginRedirect,
  queryKeysText,
  signIn,
  signOut,
  submitLoginForm,
} from './account-helpers'
import { USERS } from './credentials'
import {
  addFromCard,
  addFromDetail,
  apiCart,
  apiQuote,
  cartList,
  cartRow,
  cartSummary,
  checkoutCta,
  couponInput,
  expectBadge,
  expectCartRows,
  expectCartSummary,
  minusOf,
  orderItems,
  plusOf,
  quantityOf,
  readCartSummary,
  removeCouponButton,
  toLineRef,
  trashOf,
} from './shop-helpers'

/**
 * Carrinho (docs/SPEC.md, "Carrinho" e seção 9). Observa interface e resultado das operações;
 * os dados vêm dos handlers MSW reais (a API é consultada de dentro da página, onde o MSW roda).
 */

test.describe.configure({ timeout: 60_000 })

const ANA = USERS.ana

/** Carrinho esperado depois de acrescentar linhas ao carrinho do design. */
const line = (p: Purchase, quantity = p.quantity): CartExpectation => ({
  nftId: p.nft.id,
  editionId: p.edition.id,
  name: p.nft.name,
  tokenId: p.nft.tokenId,
  editionName: p.edition.name,
  quantity,
  unitPrice: p.nft.price,
  lineTotal: dec(p.nft.price).mul(quantity).toFixed(),
  max: maxQuantity(p.edition),
})

const withQuantity = (l: CartExpectation, quantity: number): CartExpectation => ({
  ...l,
  quantity,
  lineTotal: dec(l.unitPrice).mul(quantity).toFixed(),
})

async function asAna(page: Parameters<typeof signIn>[0]) {
  await signIn(page, 'ana', '/cart')
  await expect(cartList(page).getByRole('listitem')).toHaveCount(ANA_CART.length)
}

// ---------------------------------------------------------------------------
// 1. Valores do design
// ---------------------------------------------------------------------------

test('1. valores do design: três itens, subtotal 26.83, taxa 0.016, total 26.846 e igual à cotação da API', async ({
  page,
}) => {
  await asAna(page)

  await expectCartRows(page, ANA_CART)
  await expectCartSummary(page, {
    subtotal: DESIGN_TOTALS.subtotal,
    discount: '0',
    networkFee: DESIGN_TOTALS.networkFee,
    total: DESIGN_TOTALS.total,
  })

  // O resumo é o da cotação da API (mesmo token, mesmos handlers), nunca uma soma da tela.
  const quote = await apiQuote(page, ANA_CART.map(toLineRef))
  const shown = await readCartSummary(page)
  expect(shown.subtotal.eq(quote.subtotal)).toBe(true)
  expect(shown.discount.eq(quote.discount)).toBe(true)
  expect(shown.networkFee.eq(quote.networkFee)).toBe(true)
  expect(shown.total.eq(quote.total)).toBe(true)
  // E as contas, com decimal.js: subtotal - desconto + taxa = total.
  expect(shown.subtotal.sub(shown.discount).add(shown.networkFee).eq(shown.total)).toBe(true)
  for (const l of ANA_CART) {
    expect(quote.items.find((q) => q.editionId === l.editionId)?.lineTotal).toBe(l.lineTotal)
  }
})

// ---------------------------------------------------------------------------
// 2. Adicionar
// ---------------------------------------------------------------------------

test('2. adicionar pelo detalhe (COMPRAR) e pelo card do catálogo: badge, item e resumo pela cotação', async ({
  page,
}) => {
  await signIn(page, 'ana')
  const base = ANA_CART.reduce((n, l) => n + l.quantity, 0)
  await page.goto('/')
  await expectBadge(page, base)

  // Detalhe: edição, quantidade e COMPRAR.
  const [viaDetail, viaCard] = PICKS
  await addFromDetail(page, viaDetail)
  await expectBadge(page, base + viaDetail.quantity)
  const afterDetail = [...ANA_CART, line(viaDetail)]
  await expectCartRows(page, afterDetail)
  await expectCartSummary(page, totalsOf(afterDetail))

  // Card do catálogo: ícone de carrinho (1 unidade da primeira edição disponível).
  const edition = await addFromCard(page, viaCard.nft)
  await expectBadge(page, base + viaDetail.quantity + 1)
  await page.goto('/cart')
  const added = line({ nft: viaCard.nft, edition, quantity: 1 })
  const afterCard = [...afterDetail, added]
  await expectCartRows(page, afterCard)
  await expectCartSummary(page, totalsOf(afterCard))

  // O resumo é o da cotação da API para esses mesmos itens.
  const quote = await apiQuote(page, afterCard.map(toLineRef))
  expect((await readCartSummary(page)).total.eq(quote.total)).toBe(true)
})

// ---------------------------------------------------------------------------
// 3. Quantidade
// ---------------------------------------------------------------------------

test('3. quantidade: stepper, mínimo 1, limite do estoque com aviso e nunca valor inválido', async ({
  page,
}) => {
  await asAna(page)
  const { ivory, emerald } = ANA_ITEMS
  expect(ivory.max).toBeGreaterThan(ivory.quantity)

  // Aumentar até o limite da edição.
  const ivoryRow = cartRow(page, ivory.name)
  let lines: CartExpectation[] = [...ANA_CART]
  for (let q = ivory.quantity + 1; q <= ivory.max; q++) {
    await plusOf(ivoryRow).click()
    lines = lines.map((l) => (l.nftId === ivory.nftId ? withQuantity(l, q) : l))
    await expect(quantityOf(ivoryRow)).toHaveText(String(q))
    await expect(ivoryRow).toContainText(`Total: ${ethText(lines.find((l) => l.nftId === ivory.nftId)!.lineTotal)}`)
    await expectCartSummary(page, totalsOf(lines))
  }

  // No limite: + desabilitado e aviso acessível associado ao botão.
  const limit = `Limite de ${ivory.max} unidades`
  await expect(plusOf(ivoryRow)).toBeDisabled()
  await expect(ivoryRow.getByText(limit)).toBeVisible()
  await expect(plusOf(ivoryRow)).toHaveAccessibleDescription(limit)

  // Diminuir volta ao valor anterior e libera o +.
  await minusOf(ivoryRow).click()
  await expect(quantityOf(ivoryRow)).toHaveText(String(ivory.max - 1))
  await expect(plusOf(ivoryRow)).toBeEnabled()
  await expect(ivoryRow.getByText(limit)).toHaveCount(0)

  // Mínimo 1: diminuir até 1 desabilita o −.
  const emeraldRow = cartRow(page, emerald.name)
  for (let q = emerald.quantity - 1; q >= 1; q--) await minusOf(emeraldRow).click()
  await expect(quantityOf(emeraldRow)).toHaveText('1')
  await expect(minusOf(emeraldRow)).toBeDisabled()

  // Digitar não é possível: a quantidade é uma saída, não um campo; teclar não a altera.
  await expect(emeraldRow.getByRole('spinbutton')).toHaveCount(0)
  await expect(emeraldRow.getByRole('textbox')).toHaveCount(0)
  await quantityOf(emeraldRow).click()
  await page.keyboard.type('99')
  await expect(quantityOf(emeraldRow)).toHaveText('1')

  // E a API recusa o que a interface nunca enviaria: não inteiro, zero e acima do estoque.
  const before = await apiCart(page)
  const target = { nftId: ivory.nftId, editionId: ivory.editionId }
  for (const quantity of [2.5, 0, -1, ivory.max + 1]) {
    const res = await apiAs(page, 'PATCH', '/cart/items', { ...target, quantity })
    expect(res.status, `quantidade ${quantity}`).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
  }
  expect(await apiCart(page)).toEqual(before)
})

// ---------------------------------------------------------------------------
// 4. Remover
// ---------------------------------------------------------------------------

test('4. remover: lixeira, foco válido, resumo e badge; o último item mostra o carrinho vazio', async ({
  page,
}) => {
  await asAna(page)
  const total = ANA_CART.reduce((n, l) => n + l.quantity, 0)
  await expectBadge(page, total)

  // Remove o do meio: o foco vai para a lixeira do próximo item.
  const [first, middle, last] = ANA_CART
  await trashOf(page, middle.name, middle.editionName).click()
  await expect(cartRow(page, middle.name)).toHaveCount(0)
  await expect(trashOf(page, last.name, last.editionName)).toBeFocused()
  const afterMiddle = [first, last]
  await expectCartRows(page, afterMiddle)
  await expectCartSummary(page, totalsOf(afterMiddle))
  await expectBadge(page, total - middle.quantity)

  // Remove o último da lista: o foco volta ao anterior.
  await trashOf(page, last.name, last.editionName).click()
  await expect(cartRow(page, last.name)).toHaveCount(0)
  await expect(trashOf(page, first.name, first.editionName)).toBeFocused()
  await expectBadge(page, first.quantity)

  // Remove o único que resta: carrinho vazio, com chamada para explorar, foco no título.
  await trashOf(page, first.name, first.editionName).click()
  const empty = page.getByRole('heading', { name: 'Seu carrinho está vazio' })
  await expect(empty).toBeVisible()
  await expect(empty).toBeFocused()
  await expect(page.getByRole('link', { name: 'Explorar NFTs' })).toBeVisible()
  await expectBadge(page, 0)
  // Não há como finalizar: o resumo (e o "Conectar e finalizar") nem é mostrado sem itens.
  await expect(checkoutCta(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Conectar e finalizar' })).toHaveCount(0)
  expect((await apiCart(page)).items).toEqual([])
})

// ---------------------------------------------------------------------------
// 5. Cupom
// ---------------------------------------------------------------------------

test('5. cupom válido: desconto, total pela cotação e remoção; inválido e expirado não mudam o resumo', async ({
  page,
}) => {
  await asAna(page)
  const plain = totalsOf(ANA_CART)
  await expectCartSummary(page, plain)

  // Válido.
  await couponInput(page).fill(COUPON.valid)
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByRole('status').filter({ hasText: `Cupom ${COUPON.valid} aplicado` })).toBeVisible()
  await expect(removeCouponButton(page)).toBeVisible()

  const discount = couponDiscount(COUPON.valid, plain.subtotal)
  const discounted = totalsOf(ANA_CART, discount)
  await expectCartSummary(page, discounted)
  await expect(cartSummary(page)).toContainText(`Desconto de ${ethText(discount)}`)

  // Contas em decimal.js, e o mesmo resultado da cotação da API com o cupom.
  const shown = await readCartSummary(page)
  expect(shown.discount.gt(0)).toBe(true)
  expect(shown.subtotal.sub(shown.discount).add(shown.networkFee).eq(shown.total)).toBe(true)
  const quote = await apiQuote(page, ANA_CART.map(toLineRef), COUPON.valid)
  expect(shown.discount.eq(quote.discount)).toBe(true)
  expect(shown.total.eq(quote.total)).toBe(true)

  // Remover volta aos valores sem desconto.
  await removeCouponButton(page).click()
  await expect(removeCouponButton(page)).toHaveCount(0)
  await expectCartSummary(page, plain)
  expect((await apiCart(page)).couponCode).toBeNull()

  // Inexistente e expirado: mensagem no campo (aria-invalid + descrição) e resumo intacto.
  const cases = [
    { code: COUPON.unknown, message: 'Cupom inexistente.' },
    { code: COUPON.expired, message: 'Cupom expirado.' },
  ]
  for (const { code, message } of cases) {
    await couponInput(page).fill(code)
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expectFieldError(couponInput(page), message)
    await expect(removeCouponButton(page)).toHaveCount(0)
    await expectCartSummary(page, plain)
    expect((await apiCart(page)).couponCode, code).toBeNull()
  }
})

// ---------------------------------------------------------------------------
// 6. Persistência
// ---------------------------------------------------------------------------

test('6. persistência: F5 e fechar/abrir a página mantêm itens, quantidades e cupom', async ({
  page,
}) => {
  await asAna(page)
  const { emerald } = ANA_ITEMS
  const emeraldRow = cartRow(page, emerald.name)
  await plusOf(emeraldRow).click()
  await expect(quantityOf(emeraldRow)).toHaveText(String(emerald.quantity + 1))
  await couponInput(page).fill(COUPON.valid)
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(removeCouponButton(page)).toBeVisible()

  const lines = ANA_CART.map((l) => (l.nftId === emerald.nftId ? withQuantity(l, emerald.quantity + 1) : l))
  const expected = totalsOf(lines, couponDiscount(COUPON.valid, totalsOf(lines).subtotal))
  await expectCartSummary(page, expected)

  const check = async (p: typeof page) => {
    await expectCartRows(p, lines)
    await expect(removeCouponButton(p)).toBeVisible()
    await expect(p.getByRole('status').filter({ hasText: `Cupom ${COUPON.valid} aplicado` })).toBeVisible()
    await expectCartSummary(p, expected)
  }

  await page.reload()
  await check(page)

  // Fechar a aba e abrir outra no mesmo navegador (mesmo armazenamento).
  const context = page.context()
  await page.close()
  const reopened = await context.newPage()
  await reopened.goto('/cart')
  await check(reopened)
})

// ---------------------------------------------------------------------------
// 7. Visitante
// ---------------------------------------------------------------------------

test('7. visitante: itens sobrevivem ao F5, são mesclados ao entrar e não aparecem para outro usuário', async ({
  page,
  isMobile,
}) => {
  test.setTimeout(120_000) // F5, dois logins e trocas de usuário; no mobile beira os 60 s
  // Sem sessão, dois NFTs: um que a Ana já tem (mesma edição) e um novo.
  const ivory = ANA_ITEMS.ivory
  const guestIvory: Purchase = {
    nft: nftByName(ivory.name),
    edition: nftByName(ivory.name).editions.find((e) => e.id === ivory.editionId)!,
    quantity: 3,
  }
  const guestNew = PICKS[0]
  await addFromDetail(page, guestIvory)
  await addFromDetail(page, guestNew)

  const guestLines = [line(guestIvory), line(guestNew)]
  await expectCartRows(page, guestLines)
  await expectCartSummary(page, totalsOf(guestLines))
  await page.reload()
  await expectCartRows(page, guestLines)
  await expectBadge(page, guestIvory.quantity + guestNew.quantity)

  // Entrar como Ana: mescla sem duplicar a mesma edição (soma até o limite da edição).
  await signIn(page, 'ana', '/cart')
  const mergedIvory = Math.min(ivory.quantity + guestIvory.quantity, ivory.max)
  expect(mergedIvory).toBeGreaterThan(ivory.quantity)
  const merged = [
    ...ANA_CART.map((l) => (l.nftId === ivory.nftId ? withQuantity(l, mergedIvory) : l)),
    line(guestNew),
  ]
  await expectCartRows(page, merged)
  await expect(cartRow(page, ivory.name)).toHaveCount(1)
  await expectCartSummary(page, totalsOf(merged))
  await page.reload()
  await expectCartRows(page, merged)

  // Sair e entrar como Bruno: o carrinho da Ana não aparece para ele.
  await page.goto('/') // no mobile, /cart não tem a barra inferior usada para sair
  await signOut(page, isMobile)
  await signIn(page, 'bruno', '/cart')
  await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
  await expectBadge(page, 0)
  // (O carrossel de sugestões pode citar os mesmos NFTs; o que não pode existir é a lista de itens.)
  await expect(cartList(page)).toHaveCount(0)
  for (const l of merged) await expect(cartRow(page, l.name)).toHaveCount(0)
  expect((await queryKeysText(page)).join('\n')).not.toContain(ANA.id)
  expect((await apiCart(page)).items).toEqual([])
})

// ---------------------------------------------------------------------------
// 8. Falha e carregamento lento
// ---------------------------------------------------------------------------

test('8a. falha: com server-error alterar a quantidade mostra erro e volta ao valor anterior; no normal funciona', async ({
  page,
}) => {
  await asAna(page)
  const { emerald } = ANA_ITEMS
  const row = cartRow(page, emerald.name)
  await expect(quantityOf(row)).toHaveText(String(emerald.quantity))

  await setScenario(page, 'server-error')
  await plusOf(row).click()
  await expect(row.getByRole('alert')).toContainText('Falha transitória simulada')
  // Rollback ao valor anterior (a atualização otimista é desfeita).
  await expect(quantityOf(row)).toHaveText(String(emerald.quantity))
  await expect(plusOf(row)).toBeEnabled()

  // Cenário normal: o servidor não guardou a alteração falha, e a mesma ação agora funciona.
  await setScenario(page, 'default')
  expect((await apiCart(page)).items.find((i) => i.nftId === emerald.nftId)?.quantity).toBe(emerald.quantity)
  await plusOf(row).click()
  await expect(quantityOf(row)).toHaveText(String(emerald.quantity + 1))
  await expect(row.getByRole('alert')).toHaveCount(0)
  const lines = ANA_CART.map((l) => (l.nftId === emerald.nftId ? withQuantity(l, emerald.quantity + 1) : l))
  await expectCartSummary(page, totalsOf(lines))
  await page.reload()
  await expect(quantityOf(cartRow(page, emerald.name))).toHaveText(String(emerald.quantity + 1))
})

test('8b. carregamento lento: o resumo mostra skeleton sem deslocar o layout', async ({ page }) => {
  await asAna(page)
  await setScenario(page, 'slow', { latencyMs: 1_500 })
  await page.reload()

  // Skeleton no resumo (aria-busy, "Carregando") enquanto as respostas não chegam.
  const summary = cartSummary(page)
  await expect(summary).toHaveAttribute('aria-busy', 'true')
  await expect(summary.getByText('Carregando').first()).toBeVisible()
  const list = cartList(page)
  const skeleton = { summary: (await summary.boundingBox())!, list: (await list.boundingBox())! }

  // Pronto: valores reais e o mesmo bloco, nas mesmas posições e dimensões.
  await expectCartSummary(page, totalsOf(ANA_CART))
  await expect(summary).toHaveAttribute('aria-busy', 'false')
  await expect(summary.getByText('Carregando')).toHaveCount(0)
  const ready = { summary: (await summary.boundingBox())!, list: (await list.boundingBox())! }
  for (const key of ['summary', 'list'] as const) {
    for (const prop of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(ready[key][prop] - skeleton[key][prop]), `${key}.${prop}`).toBeLessThanOrEqual(2)
    }
  }
})

// ---------------------------------------------------------------------------
// 9. Conectar e finalizar
// ---------------------------------------------------------------------------

test('9a. "Conectar e finalizar" de visitante vai ao login e, depois de entrar, volta ao checkout com os itens', async ({
  page,
}) => {
  const pick = PICKS[0]
  await addFromDetail(page, pick)
  await checkoutCta(page).click()
  await expectLoginRedirect(page, '/checkout')
  expect(page.url()).toMatch(/\/login\?redirect=(%22)?%2Fcheckout(%22)?$/)

  await submitLoginForm(page, ANA.email, ANA.password)
  await expect(page).toHaveURL(/\/checkout$/)
  // Itens do visitante mesclados aos da Ana.
  const names = [...ANA_CART.map((l) => l.name), pick.nft.name]
  await expect(orderItems(page).getByRole('listitem')).toHaveCount(names.length)
  for (const name of names) await expect(orderItems(page).getByText(name)).toBeVisible()
})

test('9b. "Conectar e finalizar" da Ana vai direto ao checkout', async ({ page }) => {
  await asAna(page)
  const login = countRequests(page, 'POST', '/auth/login')
  await expect(checkoutCta(page)).toHaveAttribute('href', '/checkout')
  await checkoutCta(page).click()
  await expect(page).toHaveURL(/\/checkout$/)
  expect(login.count).toBe(0)
  for (const l of ANA_CART) await expect(orderItems(page).getByText(l.name)).toBeVisible()
})
