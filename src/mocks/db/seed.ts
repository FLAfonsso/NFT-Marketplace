import type { Cart, EditionName, Network, Nft, NftEdition, Order, Wallet } from '@/contracts'
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

export const SCHEMA_VERSION = 4
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

/** Coleções do design. `id` é o slug usado no filtro `collections`. */
export const NFT_COLLECTIONS = [
  { id: 'arte-digital', name: 'Arte digital' },
  { id: 'fotografia', name: 'Fotografia' },
  { id: 'musica', name: 'Música' },
  { id: 'arte-3d', name: 'Arte 3D' },
  { id: 'colecionaveis', name: 'Colecionáveis' },
  { id: 'generativa', name: 'Generativa' },
  { id: 'jogos', name: 'Jogos' },
  { id: 'assinaturas', name: 'Assinaturas' },
  { id: 'utilidade', name: 'Utilidade' },
] as const

/** As 3 redes do catálogo, com o nome de exibição. */
export const NFT_NETWORKS = [
  { id: 'ethereum', name: 'Ethereum' },
  { id: 'polygon', name: 'Polygon' },
  { id: 'base', name: 'Base' },
] as const satisfies readonly { id: Network; name: string }[]

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

const ADJECTIVES = [
  'Emerald',
  'Sage',
  'Neon',
  'Cosmic',
  'Violet',
  'Ivory',
  'Golden',
  'Crimson',
  'Silent',
  'Azure',
  'Lunar',
  'Obsidian',
] as const

const NOUNS = [
  'Ape',
  'Nomad',
  'Vessel',
  'Bloom',
  'Baron',
  'Beat',
  'Signal',
  'Echo',
  'Prism',
  'Tide',
  'Oracle',
  'Drift',
  'Pulse',
] as const

/** Preços dos NFTs gerados (ETH, string decimal). */
const PRICES = [
  '0.035',
  '0.05',
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
] as const

/**
 * NFTs nomeados no design. Ficam nas primeiras posições (mais recentes).
 * `compareAtPrice` e `badge` só existem onde o design os mostra.
 */
interface NamedNft {
  adjective: string
  noun: string
  number: number
  price: string
  compareAtPrice?: string
  badge?: 'RARO'
  rating?: { average: number; count: number }
}

const NAMED_NFTS: readonly NamedNft[] = [
  {
    adjective: 'Emerald',
    noun: 'Ape',
    number: 42,
    price: '1.19',
    badge: 'RARO',
    rating: { average: 4.8, count: 19 },
  },
  { adjective: 'Sage', noun: 'Nomad', number: 9, price: '1.69' },
  { adjective: 'Neon', noun: 'Vessel', number: 552, price: '1.99', compareAtPrice: '2.29' },
  { adjective: 'Cosmic', noun: 'Bloom', number: 118, price: '1.29' },
  { adjective: 'Violet', noun: 'Nomad', number: 314, price: '1.39' },
  { adjective: 'Ivory', noun: 'Baron', number: 88, price: '1.79' },
  { adjective: 'Golden', noun: 'Beat', number: 207, price: '0.99' },
  { adjective: 'Golden', noun: 'Signal', number: 160, price: '0.39' },
  { adjective: 'Golden', noun: 'Frequency', number: 71, price: '0.59' },
]

/** Estes três precisam de estoque folgado (pelo menos 9 unidades nas edições não únicas). */
const HIGH_STOCK_NUMBERS = new Set([42, 314, 88])

/** Extremos da faixa de preço do design, em posições fixas (fora dos nomeados). */
const MIN_PRICE_INDEX = 20
const MAX_PRICE_INDEX = 21

/** Único NFT em destaque: Emerald Ape #042. */
const FEATURED_INDEX = 0

/** 36 NFTs = 4 páginas de 9. */
const NFT_COUNT = 36

/** Tiragem e limite por pedido de cada edição. ABERTA não tem tiragem real. */
const EDITION_SPECS: Record<EditionName, { supply: number; maxPerOrder: number }> = {
  '1/1': { supply: 1, maxPerOrder: 1 },
  '1/10': { supply: 10, maxPerOrder: 5 },
  '1/50': { supply: 50, maxPerOrder: 10 },
  ABERTA: { supply: 1000, maxPerOrder: 10 },
}
const EDITION_ORDER = ['1/1', '1/10', '1/50', 'ABERTA'] as const satisfies readonly EditionName[]

const ATTRIBUTE_TRAITS = {
  Fundo: ['Areia', 'Carvão', 'Âmbar', 'Névoa', 'Cobre'],
  Aura: ['Brasa', 'Esmeralda', 'Violeta', 'Marfim', 'Neon'],
  Olhos: ['Calmos', 'Brilhantes', 'Fechados', 'Dourados'],
  Raridade: ['Comum', 'Incomum', 'Rara', 'Épica'],
} as const

/** Arquivos de public/assets usados como arte dos NFTs. */
const ASSET_IMAGES = ['Eape', 'Sape', 'Nape', 'Gape'] as const
type AssetImage = (typeof ASSET_IMAGES)[number]

/** Arte principal dos NFTs nomeados (docs/design/screens.md, seção Assets). */
const NAMED_IMAGE: Record<string, AssetImage> = {
  Emerald_Ape: 'Eape',
  Sage_Nomad: 'Sape',
  Neon_Vessel: 'Nape',
  Ivory_Baron: 'Nape',
  Golden_Beat: 'Gape',
  Golden_Signal: 'Gape',
  Golden_Frequency: 'Gape',
}

/** Galeria de 4 imagens: a principal primeiro, depois as outras artes em ordem fixa. */
const buildGallery = (name: string, main: AssetImage) => {
  const start = ASSET_IMAGES.indexOf(main)
  return [0, 1, 2, 3].map((v) => ({
    url: `/assets/${ASSET_IMAGES[(start + v) % ASSET_IMAGES.length]}.png`,
    alt: `${name}, ${v === 0 ? 'arte principal' : `visão ${v + 1}`}`,
  }))
}

const pad = (n: number, size = 3) => String(n).padStart(size, '0')

interface NameParts {
  adjective: string
  noun: string
  number: number
}

/** Nomes "Adjetivo Substantivo #NNN": os fixos primeiro, o resto gerado sem repetir. */
const buildNames = (rng: ReturnType<typeof createRng>): NameParts[] => {
  const names: NameParts[] = NAMED_NFTS.map(({ adjective, noun, number }) => ({
    adjective,
    noun,
    number,
  }))
  const usedNumbers = new Set<number>(names.map((n) => n.number))
  const usedPairs = new Set(names.map((n) => `${n.adjective} ${n.noun}`))
  let k = 0
  while (names.length < NFT_COUNT) {
    const adjective = ADJECTIVES[k % ADJECTIVES.length]
    const noun = NOUNS[(k * 5 + 7) % NOUNS.length]
    k++
    if (usedPairs.has(`${adjective} ${noun}`)) continue
    let number = rng.int(1, 999)
    while (usedNumbers.has(number)) number = (number % 999) + 1
    usedPairs.add(`${adjective} ${noun}`)
    usedNumbers.add(number)
    names.push({ adjective, noun, number })
  }
  return names
}

const buildEditions = (
  id: string,
  rng: ReturnType<typeof createRng>,
  mode: 'high' | 'sold-out' | 'normal',
): NftEdition[] =>
  EDITION_ORDER.map((name, e) => {
    const { supply, maxPerOrder } = EDITION_SPECS[name]
    // Duas leituras do PRNG por edição, sempre, para a sequência não depender do ramo.
    const roll = rng.next()
    const amount = rng.int(1, name === 'ABERTA' ? 300 : supply)
    let available: number
    if (mode === 'high') {
      available = name === '1/1' ? 1 : name === 'ABERTA' ? 500 : supply
    } else if (mode === 'sold-out') {
      available = 0
    } else {
      available = roll < 0.15 ? 0 : amount
    }
    return { id: `${id}_ed${e + 1}`, name, supply, available, maxPerOrder }
  })

const buildNfts = (): Nft[] => {
  const rng = createRng(RNG_SEED)
  const names = buildNames(rng)
  const nfts: Nft[] = []

  for (let i = 0; i < NFT_COUNT; i++) {
    const id = `nft_${pad(i + 1)}`
    const { adjective, noun, number } = names[i]
    const named = NAMED_NFTS[i] as NamedNft | undefined
    const tag = `#${pad(number)}`
    const name = `${adjective} ${noun} ${tag}`

    // As primeiras posições cobrem todas as coleções e redes; o resto é sorteado.
    const collectionIndex = rng.int(0, NFT_COLLECTIONS.length - 1)
    const networkIndex = rng.int(0, NFT_NETWORKS.length - 1)
    const collection = NFT_COLLECTIONS[i < NFT_COLLECTIONS.length ? i : collectionIndex]
    const network = NFT_NETWORKS[i < NFT_NETWORKS.length ? i : networkIndex]
    const creator = CREATORS[(i * 3) % CREATORS.length]

    const generatedPrice = rng.pick(PRICES)
    const price =
      named?.price ??
      (i === MIN_PRICE_INDEX ? '0.02' : i === MAX_PRICE_INDEX ? '12.30' : generatedPrice)
    // Leituras mantidas para a sequência do PRNG (e o seed) não mudar.
    rng.int(0, 359)
    rng.int(40, 160)
    const ratingAverage = rng.int(38, 50) / 10
    const ratingCount = rng.int(3, 240)
    const rating = named?.rating ?? { average: ratingAverage, count: ratingCount }

    // Um NFT inteiro esgotado a cada 9, nas posições fora dos nomeados.
    const mode = HIGH_STOCK_NUMBERS.has(number) ? 'high' : !named && i % 9 === 8 ? 'sold-out' : 'normal'

    const attributes = Object.entries(ATTRIBUTE_TRAITS).map(([traitType, values]) => ({
      traitType,
      value: rng.pick(values),
    }))

    const gallery = buildGallery(
      name,
      NAMED_IMAGE[`${adjective}_${noun}`] ?? ASSET_IMAGES[i % ASSET_IMAGES.length],
    )

    nfts.push({
      id,
      name,
      description:
        `${adjective} ${noun} é uma peça da coleção ${collection.name} criada por ${creator}, ` +
        `cunhada na rede ${network.name}.`,
      creator,
      network: network.id,
      collection: collection.id,
      collectionName: collection.name,
      ...(named?.badge ? { badge: named.badge } : {}),
      tokenId: pad(number, 4),
      gallery,
      attributes,
      price,
      ...(named?.compareAtPrice ? { compareAtPrice: named.compareAtPrice } : {}),
      rating,
      editions: buildEditions(id, rng, mode),
      featured: i === FEATURED_INDEX,
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
    username: 'ana_souza',
    email: 'ana@example.com',
    ensName: 'ana.eth',
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
    username: 'bruno_lima',
    email: 'bruno@example.com',
    ensName: 'bruno.eth',
    avatarUrl: null,
    passwordSalt: 'c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8',
    passwordHash: '29ce12dccaacff4a57dc24d8e71b14ca66a57072fe82509f1cf1b27bca4ce1a2',
    createdAt: iso(-60 * DAY),
    updatedAt: iso(-60 * DAY),
    version: 1,
  },
]

/** Códigos de indicação fictícios dos usuários de teste (documentados em docs/API.md). */
export const SEED_REFERRAL_CODES = {
  ana: 'KURIO-ANA26',
  bruno: 'KURIO-BRUNO26',
} as const

const ANA_PRIMARY_ADDRESS = '0x5a3c9e1b7d2f4a6c8e0b1d3f5a7c9e1b3d5f7a90'

const buildWallets = (): Record<string, Wallet[]> => {
  const ana = {
    displayName: 'Ana Souza',
    username: 'ana_souza',
    profileName: 'Ana Souza',
    email: 'ana@example.com',
    ensName: 'ana.eth',
    referralCode: SEED_REFERRAL_CODES.ana,
  }
  const bruno = {
    displayName: 'Bruno Lima',
    username: 'bruno_lima',
    profileName: 'Bruno Lima',
    email: 'bruno@example.com',
    ensName: 'bruno.eth',
    referralCode: SEED_REFERRAL_CODES.bruno,
  }
  return {
    [SEED_USER_IDS.ana]: [
      {
        ...ana,
        id: 'wal_ana_1',
        nickname: 'Principal',
        address: ANA_PRIMARY_ADDRESS,
        role: 'primary',
        walletType: 'MetaMask',
        network: 'ethereum',
        secondaryWallet: '0x1f2e3d4c5b6a79880716253443526170f8e9d0c1',
        createdAt: iso(-90 * DAY),
        updatedAt: iso(-90 * DAY),
      },
      {
        ...ana,
        id: 'wal_ana_2',
        nickname: 'Reserva',
        address: '0x1f2e3d4c5b6a79880716253443526170f8e9d0c1',
        role: 'secondary',
        walletType: 'WalletConnect',
        network: 'polygon',
        createdAt: iso(-40 * DAY),
        updatedAt: iso(-40 * DAY),
      },
    ],
    [SEED_USER_IDS.bruno]: [
      {
        ...bruno,
        id: 'wal_bruno_1',
        nickname: 'Principal',
        address: '0x9b8a7c6d5e4f30211203f4e5d6c7b8a9e0f1a2b3',
        role: 'primary',
        walletType: 'Coinbase Wallet',
        network: 'base',
        createdAt: iso(-60 * DAY),
        updatedAt: iso(-60 * DAY),
      },
      {
        ...bruno,
        // Termina em "dead": pagamentos com esta carteira são recusados.
        id: 'wal_bruno_2',
        nickname: 'Sem saldo',
        address: `0x${'0'.repeat(36)}${REJECTING_ADDRESS_SUFFIX}`,
        role: 'secondary',
        walletType: 'MetaMask',
        network: 'ethereum',
        createdAt: iso(-20 * DAY),
        updatedAt: iso(-20 * DAY),
      },
    ],
  }
}

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
      imageUrl: nft.gallery[0].url,
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
      walletAddress: ANA_PRIMARY_ADDRESS,
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
  // Carrinho do Figma: Emerald Ape x2, Violet Nomad x6, Ivory Baron x9 (edição 1/50, limite 10).
  const cartLine = (number: number, quantity: number) => {
    const nft = nfts.find((n) => n.tokenId === pad(number, 4))
    const edition = nft?.editions.find((e) => e.name === '1/50')
    if (!nft || !edition) throw new Error(`Seed: NFT #${number} sem edição 1/50`)
    return { nftId: nft.id, editionId: edition.id, quantity }
  }
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
          cartLine(42, 2),
          cartLine(314, 6),
          cartLine(88, 9),
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
