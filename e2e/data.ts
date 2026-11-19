import Decimal from 'decimal.js'
import { createSeed, SEED_COUPON_CODES, SEED_USER_IDS } from '../src/mocks/db/seed'

/**
 * Dados de referência dos testes de carrinho e compra. Tudo é lido do seed dos mocks
 * (src/mocks/db/seed.ts), a única fonte; nenhum número fica solto nos specs.
 * `createSeed()` devolve sempre o mesmo estado, o mesmo que `window.__mocks.reset()` restaura.
 */

const seed = createSeed()

// ---------------------------------------------------------------------------
// ETH
// ---------------------------------------------------------------------------

/** Mesmo formato do app (docs/design/tokens.md): ponto, mínimo de 2 casas, sem zeros extras. */
export function fmtEth(value: Decimal.Value): string {
  const [int, frac = ''] = new Decimal(value).toFixed().split('.')
  return `${int}.${frac.replace(/0+$/, '').padEnd(2, '0')}`
}

export const dec = (value: Decimal.Value) => new Decimal(value)

/** Soma decimal (nunca com number). */
export const sumEth = (values: readonly Decimal.Value[]) =>
  values.reduce<Decimal>((total, v) => total.add(v), new Decimal(0))

/** ETH "bruto" -> "x.xx ETH" como a interface mostra. */
export const ethText = (value: Decimal.Value) => `${fmtEth(value)} ETH`

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export type SeedNft = (typeof seed.nfts)[number]

export const nftByName = (name: string): SeedNft => {
  const nft = seed.nfts.find((n) => n.name === name)
  if (!nft) throw new Error(`Seed sem NFT "${name}"`)
  return nft
}

export const editionOf = (nft: SeedNft, name: string) => {
  const edition = nft.editions.find((e) => e.name === name)
  if (!edition) throw new Error(`${nft.name} sem edição ${name}`)
  return edition
}

/** Quantidade máxima aceita no carrinho para a edição: o menor entre estoque e limite por pedido. */
export const maxQuantity = (edition: { available: number; maxPerOrder: number }) =>
  Math.min(edition.available, edition.maxPerOrder)

// ---------------------------------------------------------------------------
// Carrinho do design (Ana)
// ---------------------------------------------------------------------------

/** Valores do Figma para o carrinho inicial da Ana. O seed precisa reproduzi-los (conferido abaixo). */
export const DESIGN_TOTALS = { subtotal: '26.83', networkFee: '0.016', total: '26.846' } as const

const anaCart = seed.carts[`user:${SEED_USER_IDS.ana}`]

export type CartExpectation = {
  nftId: string
  editionId: string
  name: string
  tokenId: string
  editionName: string
  quantity: number
  unitPrice: string
  lineTotal: string
  max: number
}

const expectationFor = (item: { nftId: string; editionId: string; quantity: number }): CartExpectation => {
  const nft = seed.nfts.find((n) => n.id === item.nftId)!
  const edition = nft.editions.find((e) => e.id === item.editionId)!
  return {
    nftId: nft.id,
    editionId: edition.id,
    name: nft.name,
    tokenId: nft.tokenId,
    editionName: edition.name,
    quantity: item.quantity,
    unitPrice: nft.price,
    lineTotal: dec(nft.price).mul(item.quantity).toFixed(),
    max: maxQuantity(edition),
  }
}

export const ANA_CART: readonly CartExpectation[] = anaCart.items.map(expectationFor)

/** Valores de um conjunto de linhas (subtotal, com a taxa fixa de rede e total). */
export function totalsOf(
  lines: readonly Pick<CartExpectation, 'lineTotal'>[],
  discount: Decimal.Value = 0,
) {
  const subtotal = sumEth(lines.map((l) => l.lineTotal))
  const networkFee = lines.length > 0 ? dec(DESIGN_TOTALS.networkFee) : dec(0)
  return {
    subtotal: subtotal.toFixed(),
    discount: dec(discount).toFixed(),
    networkFee: networkFee.toFixed(),
    total: subtotal.sub(discount).add(networkFee).toFixed(),
  }
}

// Falha cedo se o seed deixar de reproduzir o design (os testes assumem esta referência).
{
  const t = totalsOf(ANA_CART)
  if (
    ANA_CART.length !== 3 ||
    t.subtotal !== DESIGN_TOTALS.subtotal ||
    t.networkFee !== DESIGN_TOTALS.networkFee ||
    t.total !== DESIGN_TOTALS.total
  ) {
    throw new Error(`O seed não reproduz o carrinho do design: ${JSON.stringify(t)}`)
  }
}

export const ANA_ITEMS = {
  emerald: ANA_CART.find((l) => l.name.startsWith('Emerald Ape'))!,
  violet: ANA_CART.find((l) => l.name.startsWith('Violet Nomad'))!,
  ivory: ANA_CART.find((l) => l.name.startsWith('Ivory Baron'))!,
}

// ---------------------------------------------------------------------------
// NFTs usados nas compras
// ---------------------------------------------------------------------------

/**
 * NFTs com estoque folgado (o suficiente para comprar e ainda somar mais ao carrinho enquanto o
 * pedido reserva estoque) que NÃO estão no carrinho da Ana. Escolhidos pelo estoque do seed, não
 * pelo nome, para o teste não depender do sorteio.
 */
const inAnaCart = new Set(ANA_CART.map((l) => l.nftId))

function pickWithStock(minAvailable: number, index: number) {
  // Um NFT por escolha (a primeira edição com estoque folgado), para os NFTs serem sempre distintos.
  const found = seed.nfts
    .filter((n) => !inAnaCart.has(n.id))
    .flatMap((nft) => {
      const edition = nft.editions.find(
        (e) => e.name !== '1/1' && e.available >= minAvailable && e.maxPerOrder >= 3,
      )
      return edition ? [{ nft, edition }] : []
    })
  const pick = found[index]
  if (!pick) throw new Error('Seed sem NFT com estoque suficiente para o teste')
  return pick
}

export type Purchase = { nft: SeedNft; edition: SeedNft['editions'][number]; quantity: number }

/** Três NFTs distintos, cada um com uma edição e uma quantidade para comprar/adicionar. */
export const PICKS = [0, 1, 2].map((i) => {
  const { nft, edition } = pickWithStock(8, i)
  return { nft, edition, quantity: 2 + (i % 2) } satisfies Purchase
}) as [Purchase, Purchase, Purchase]

// ---------------------------------------------------------------------------
// Cupons
// ---------------------------------------------------------------------------

const couponOf = (code: string) => seed.coupons.find((c) => c.code === code)

export const COUPON = {
  valid: SEED_COUPON_CODES.valid,
  expired: SEED_COUPON_CODES.expired,
  /** Não existe no seed de propósito. */
  unknown: SEED_COUPON_CODES.unknown,
} as const

/** Desconto esperado de um cupom do seed para um subtotal (sempre decimal.js). */
export function couponDiscount(code: string, subtotal: Decimal.Value): string {
  const coupon = couponOf(code)
  if (!coupon) throw new Error(`Cupom "${code}" não existe no seed`)
  let discount =
    coupon.kind === 'percent' ? dec(subtotal).mul(coupon.value).div(100) : dec(coupon.value)
  if (coupon.maxDiscount) discount = Decimal.min(discount, coupon.maxDiscount)
  return Decimal.min(discount, subtotal).toFixed()
}

export const COUPON_VALID_CODE_LOWER = COUPON.valid.toLowerCase()

// ---------------------------------------------------------------------------
// Formulário do colecionador (valores válidos para o checkout)
// ---------------------------------------------------------------------------

/** Carteiras cadastradas no seed (o pedido exige que o endereço e a rede do formulário sejam os dela). */
export const WALLETS = {
  ana: seed.wallets[SEED_USER_IDS.ana].find((w) => w.role === 'primary')!,
  bruno: seed.wallets[SEED_USER_IDS.bruno].find((w) => w.role === 'primary')!,
}

export const COLLECTOR = {
  displayName: 'Colecionador Teste',
  username: 'colecionador_teste',
  profileName: 'Colecionador Teste',
  email: 'colecionador.teste@example.com',
  referralCode: 'KURIO-TESTE26',
  ensLabel: 'colecionador-teste',
  note: 'Pedido do teste E2E',
} as const

export const INVALID_EMAIL = 'isto-nao-e-um-email'
/** 0x com 39 hexadecimais. */
export const INVALID_ADDRESS = `0x${'a1b2c3d4e5'.repeat(4).slice(1)}`
