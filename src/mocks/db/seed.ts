import type { Cart, Nft, NftEdition, Order, Wallet } from '@/contracts'
import type { CouponRecord, DbState, OrderRecord, UserRecord } from './types'
import { createRng, deepFreeze, Eth, stableStringify, toEthString, transactionRefFor } from './util'

/**
 * Fixtures determinísticas. Tudo é derivado de constantes e de um PRNG com semente fixa:
 * `createSeed()` sempre devolve exatamente o mesmo estado.
 *
 * Credenciais de demonstração (documentadas em docs/API.md; aqui só existe o hash):
 * - ana@example.com
 * - bruno@example.com
 */

export const SCHEMA_VERSION = 1
const RNG_SEED = 20261101
/** "Agora" do cenário: datas do seed são relativas a ele. */
const SEED_NOW = Date.parse('2026-11-01T12:00:00.000Z')
const iso = (offsetMs: number) => new Date(SEED_NOW + offsetMs).toISOString()
const HOUR = 3_600_000
const DAY = 24 * HOUR

export const SEED_USER_IDS = { ana: 'usr_ana', bruno: 'usr_bruno' } as const

/** Códigos de cupom para os cenários de cotação. `unknown` não existe de propósito. */
export const SEED_COUPON_CODES = {
  valid: 'BEMVINDO10',
  fixed: 'MENOS005',
  expired: 'BLACKFRIDAY25',
  unknown: 'NAOEXISTE',
} as const

/**
 * Carteiras cujo endereço termina com este sufixo têm o pagamento recusado na simulação.
 * Permite reproduzir "pagamento recusado" de forma determinística.
 */
export const REJECTING_ADDRESS_SUFFIX = 'dead'

export const NFT_CATEGORIES = [
  'Arte',
  'Fotografia',
  'Música',
  'Games',
  'Colecionáveis',
  'Esportes',
] as const

const CREATORS = [
  'Lúmen Studio',
  'Marina Kato',
  'Coletivo Órbita',
  'Rafael Prado',
  'Pixel Sertão',
  'Yara Nunes',
  'Nó Digital',
  'Theo Albuquerque',
] as const

const NOUNS = [
  'Aurora',
  'Horizonte',
  'Eclipse',
  'Maré',
  'Labirinto',
  'Vórtice',
  'Constelação',
  'Relâmpago',
  'Oásis',
  'Fractal',
  'Cometa',
  'Miragem',
] as const

const ADJECTIVES = [
  'Neon',
  'Silenciosa',
  'Carmesim',
  'Infinita',
  'Dourada',
  'Submersa',
  'Elétrica',
  'Polar',
] as const

const PRICES = [
  '0.005',
  '0.012',
  '0.025',
  '0.04',
  '0.075',
  '0.1',
  '0.15',
  '0.2',
  '0.35',
  '0.5',
  '0.8',
  '1',
  '1.25',
  '2',
  '3.5',
  '5',
  '8.75',
  '12.5',
] as const

const EDITION_NAMES = ['Standard', 'Gold', 'Genesis'] as const
const SUPPLIES = [1, 5, 10, 25, 50, 100, 250] as const
const MAX_PER_ORDER = [1, 2, 5, 10] as const

const NFT_COUNT = 48

const svgImage = (title: string, hueA: number, hueB: number, variant: number) => {
  const shape =
    variant % 3 === 0
      ? '<circle cx="300" cy="300" r="170" fill="white" fill-opacity="0.18"/>'
      : variant % 3 === 1
        ? '<rect x="130" y="130" width="340" height="340" rx="40" fill="white" fill-opacity="0.18" transform="rotate(12 300 300)"/>'
        : '<polygon points="300,110 490,450 110,450" fill="white" fill-opacity="0.18"/>'
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hueA} 80% 55%)"/>` +
    `<stop offset="1" stop-color="hsl(${hueB} 75% 35%)"/></linearGradient></defs>` +
    `<rect width="600" height="600" fill="url(#g)"/>${shape}` +
    `<text x="300" y="330" font-family="sans-serif" font-size="96" font-weight="700" ` +
    `text-anchor="middle" fill="white" fill-opacity="0.9">${title}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const pad = (n: number) => String(n).padStart(3, '0')

const buildNfts = (): Nft[] => {
  const rng = createRng(RNG_SEED)
  const nfts: Nft[] = []

  for (let i = 0; i < NFT_COUNT; i++) {
    const id = `nft_${pad(i + 1)}`
    const noun = NOUNS[i % NOUNS.length]
    const adjective = ADJECTIVES[(i * 5) % ADJECTIVES.length]
    const name = `${noun} ${adjective} #${i + 1}`
    const category = NFT_CATEGORIES[i % NFT_CATEGORIES.length]
    const creator = CREATORS[(i * 3) % CREATORS.length]
    const price = rng.pick(PRICES)
    const hueA = rng.int(0, 359)
    const hueB = (hueA + rng.int(40, 160)) % 360

    // A cada 9 NFTs, um totalmente esgotado (posição 4 do ciclo).
    const soldOut = i % 9 === 4
    const editionCount = rng.int(1, 3)
    const editions: NftEdition[] = []
    for (let e = 0; e < editionCount; e++) {
      const supply = rng.pick(SUPPLIES)
      const partialSoldOut = rng.next() < 0.15
      const available = soldOut || partialSoldOut ? 0 : rng.int(1, supply)
      editions.push({
        id: `${id}_ed${e + 1}`,
        name: EDITION_NAMES[e],
        supply,
        available,
        maxPerOrder: Math.min(supply, rng.pick(MAX_PER_ORDER)),
      })
    }

    const images = [
      { url: svgImage(`#${i + 1}`, hueA, hueB, i), alt: `${name}, arte principal` },
    ]
    if (i % 4 === 0) {
      images.push({
        url: svgImage(noun.slice(0, 2), hueB, hueA, i + 1),
        alt: `${name}, variação alternativa`,
      })
    }

    nfts.push({
      id,
      name,
      description: `${noun} ${adjective.toLowerCase()} é uma peça de ${category.toLowerCase()} criada por ${creator}.`,
      creator,
      category,
      images,
      price,
      editions,
      featured: i % 8 === 0,
      // Mais recentes primeiro: o NFT 1 é o mais novo.
      createdAt: iso(-(i * 13 * HOUR) - DAY),
      version: 1,
    })
  }
  return nfts
}

/** Hashes PBKDF2-SHA256 (100 000 iterações) pré-calculados. As senhas não aparecem no código. */
const buildUsers = (): UserRecord[] => [
  {
    id: SEED_USER_IDS.ana,
    name: 'Ana Souza',
    email: 'ana@example.com',
    bio: 'Coleciono arte generativa e fotografia.',
    avatarUrl: null,
    passwordSalt: '6a1f0c9b3e5d7a2c4b8e1f0d3a6c9b2e',
    passwordHash: 'aa60ad870402299b58aff85d8e63c43e6b70e114eb45e28a3addfcb2f503307d',
    createdAt: iso(-90 * DAY),
    updatedAt: iso(-30 * DAY),
    version: 1,
  },
  {
    id: SEED_USER_IDS.bruno,
    name: 'Bruno Lima',
    email: 'bruno@example.com',
    bio: '',
    avatarUrl: null,
    passwordSalt: 'c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8',
    passwordHash: '29ce12dccaacff4a57dc24d8e71b14ca66a57072fe82509f1cf1b27bca4ce1a2',
    createdAt: iso(-60 * DAY),
    updatedAt: iso(-60 * DAY),
    version: 1,
  },
]

const buildWallets = (): Record<string, Wallet[]> => ({
  [SEED_USER_IDS.ana]: [
    {
      id: 'wal_ana_1',
      label: 'Principal',
      address: '0x5a3c9e1b7d2f4a6c8e0b1d3f5a7c9e1b3d5f7a90',
      role: 'primary',
      network: 'ethereum',
      createdAt: iso(-90 * DAY),
      updatedAt: iso(-90 * DAY),
    },
    {
      id: 'wal_ana_2',
      label: 'Polygon',
      address: '0x1f2e3d4c5b6a79880716253443526170f8e9d0c1',
      role: 'secondary',
      network: 'polygon',
      createdAt: iso(-40 * DAY),
      updatedAt: iso(-40 * DAY),
    },
  ],
  [SEED_USER_IDS.bruno]: [
    {
      id: 'wal_bruno_1',
      label: 'Base',
      address: '0x9b8a7c6d5e4f30211203f4e5d6c7b8a9e0f1a2b3',
      role: 'primary',
      network: 'base',
      createdAt: iso(-60 * DAY),
      updatedAt: iso(-60 * DAY),
    },
    {
      // Termina em "dead": pagamentos com esta carteira são recusados.
      id: 'wal_bruno_2',
      label: 'Sem saldo',
      address: `0x${'0'.repeat(36)}${REJECTING_ADDRESS_SUFFIX}`,
      role: 'secondary',
      network: 'ethereum',
      createdAt: iso(-20 * DAY),
      updatedAt: iso(-20 * DAY),
    },
  ],
})

const buildCoupons = (): CouponRecord[] => [
  {
    code: SEED_COUPON_CODES.valid,
    kind: 'percent',
    value: '10',
    maxDiscount: '0.5',
    expiresAt: '2099-12-31T23:59:59.000Z',
  },
  {
    code: SEED_COUPON_CODES.fixed,
    kind: 'fixed',
    value: '0.005',
    maxDiscount: null,
    expiresAt: '2099-12-31T23:59:59.000Z',
  },
  {
    code: SEED_COUPON_CODES.expired,
    kind: 'percent',
    value: '25',
    maxDiscount: null,
    expiresAt: '2025-11-30T23:59:59.000Z',
  },
]

const firstAvailable = (nfts: Nft[], skip: number) =>
  nfts
    .flatMap((nft) =>
      nft.editions.filter((e) => e.available >= 2).map((edition) => ({ nft, edition })),
    )
    .slice(skip)[0]

const buildCart = (id: string, items: Cart['items'], updatedAt: string): Cart => ({
  id,
  items,
  couponCode: null,
  updatedAt,
  version: 1,
})

/** Pedido confirmado no histórico da Ana, para exercitar a tela de recibo. */
const buildPastOrder = (nfts: Nft[]): OrderRecord => {
  const { nft, edition } = firstAvailable(nfts, 3)
  const quantity = 1
  const unitPrice = nft.price
  const subtotal = new Eth(unitPrice).mul(quantity)
  const networkFee = new Eth('0.0018')
  const id = 'ord_seed_1'
  const items = [
    {
      nftId: nft.id,
      editionId: edition.id,
      nftName: nft.name,
      editionName: edition.name,
      imageUrl: nft.images[0].url,
      quantity,
      unitPrice,
      lineTotal: toEthString(subtotal),
    },
  ]
  const order: Order = {
    id,
    idempotencyKey: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    status: 'confirmed',
    snapshot: {
      items,
      couponCode: null,
      subtotal: toEthString(subtotal),
      discount: '0',
      networkFee: toEthString(networkFee),
      total: toEthString(subtotal.add(networkFee)),
      walletAddress: '0x5a3c9e1b7d2f4a6c8e0b1d3f5a7c9e1b3d5f7a90',
      network: 'ethereum',
      buyer: { name: 'Ana Souza', email: 'ana@example.com' },
    },
    transactionRef: transactionRefFor(id, 'ethereum'),
    rejectionReason: null,
    createdAt: iso(-10 * DAY),
    updatedAt: iso(-10 * DAY + 3000),
    version: 2,
  }
  return {
    order,
    userId: SEED_USER_IDS.ana,
    fingerprint: stableStringify({ seed: id }),
    settleAt: order.updatedAt,
  }
}

const buildSeed = (): DbState => {
  const nfts = buildNfts()
  const anaCartItem = firstAvailable(nfts, 0)
  const anaCartItem2 = firstAvailable(nfts, 5)
  return {
    schemaVersion: SCHEMA_VERSION,
    seq: 1000,
    users: buildUsers(),
    sessions: {},
    nfts,
    coupons: buildCoupons(),
    favorites: {
      [SEED_USER_IDS.ana]: ['nft_003', 'nft_010', 'nft_017'],
      [SEED_USER_IDS.bruno]: ['nft_001'],
    },
    carts: {
      [`user:${SEED_USER_IDS.ana}`]: buildCart(
        `cart_${SEED_USER_IDS.ana}`,
        [
          { nftId: anaCartItem.nft.id, editionId: anaCartItem.edition.id, quantity: 1 },
          { nftId: anaCartItem2.nft.id, editionId: anaCartItem2.edition.id, quantity: 2 },
        ],
        iso(-2 * DAY),
      ),
      [`user:${SEED_USER_IDS.bruno}`]: buildCart(`cart_${SEED_USER_IDS.bruno}`, [], iso(-60 * DAY)),
    },
    wallets: buildWallets(),
    quotes: {},
    lastQuotedPrices: {},
    orders: [buildPastOrder(nfts)],
  }
}

/** Seed congelado: nunca é alterado; o store trabalha sempre sobre cópias. */
const SEED = deepFreeze(buildSeed())

/** Cópia nova e mutável do cenário conhecido. */
export const createSeed = (): DbState => structuredClone(SEED) as DbState
