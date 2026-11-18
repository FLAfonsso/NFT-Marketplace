import { z } from 'zod'
import {
  Count,
  EthString,
  Id,
  IsoDateTime,
  PAGE_SIZE_MAX,
  Quantity,
  Version,
  paginated,
} from './common'
import { Network } from './wallet'

export const NftImage = z.object({
  url: z.string().min(1),
  alt: z.string(),
})
export type NftImage = z.infer<typeof NftImage>

/** Nomes das edições, na ordem em que o design as mostra. */
export const EDITION_NAMES = ['1/1', '1/10', '1/50', 'ABERTA'] as const
export const EditionName = z.enum(EDITION_NAMES)
export type EditionName = z.infer<typeof EditionName>

export const NftEdition = z.object({
  id: Id,
  name: EditionName,
  /** Tiragem. A edição ABERTA usa um teto alto simbólico. */
  supply: Quantity,
  /** Unidades disponíveis agora. Zero significa edição esgotada. */
  available: Count,
  /** Limite de unidades por pedido. */
  maxPerOrder: Quantity,
})
export type NftEdition = z.infer<typeof NftEdition>

export const NFT_BADGES = ['RARO'] as const
export const NftBadge = z.enum(NFT_BADGES)
export type NftBadge = z.infer<typeof NftBadge>

export const NftAttribute = z.object({
  traitType: z.string().min(1),
  value: z.string().min(1),
})
export type NftAttribute = z.infer<typeof NftAttribute>

export const NftRating = z.object({
  /** Nota média de 0 a 5, com uma casa decimal. */
  average: z.number().min(0).max(5),
  count: Count,
})
export type NftRating = z.infer<typeof NftRating>

export const NFT_GALLERY_SIZE = 4

export const Nft = z.object({
  id: Id,
  name: z.string().min(1),
  description: z.string(),
  creator: z.string().min(1),
  network: Network,
  /** Identificador (slug) da coleção. É o valor usado no filtro `collections`. */
  collection: Id,
  collectionName: z.string().min(1),
  badge: NftBadge.optional(),
  /** ID do token, só dígitos, com zeros à esquerda (o nome "#314" tem token "0314"). */
  tokenId: z.string().regex(/^\d{4,}$/),
  gallery: z.array(NftImage).length(NFT_GALLERY_SIZE),
  attributes: z.array(NftAttribute),
  price: EthString,
  /** Preço antigo, exibido riscado ao lado do preço atual. */
  compareAtPrice: EthString.optional(),
  rating: NftRating,
  editions: z.array(NftEdition).length(EDITION_NAMES.length),
  featured: z.boolean(),
  createdAt: IsoDateTime,
  version: Version,
})
export type Nft = z.infer<typeof Nft>

export const NFT_VIEWS = ['all', 'new', 'trending'] as const
export const NftView = z.enum(NFT_VIEWS)
export type NftView = z.infer<typeof NftView>

export const NFT_SORTS = ['recent', 'price_asc', 'price_desc', 'name_asc'] as const
export const NftSort = z.enum(NFT_SORTS)
export type NftSort = z.infer<typeof NftSort>

export const NFT_PAGE_SIZE_DEFAULT = 9

/**
 * Lista na query string: aceita chave repetida (`collections=a&collections=b`),
 * `collections[]=a` (tratado pelo handler) ou separada por vírgula (`collections=a,b`).
 */
const listParam = <T extends z.ZodType>(item: T) =>
  z.preprocess(
    (value) =>
      typeof value === 'string'
        ? value.split(',').filter(Boolean)
        : value === undefined
          ? []
          : value,
    z.array(item).max(50),
  )

export const NftListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  view: NftView.default('all'),
  collections: listParam(Id),
  networks: listParam(Network),
  priceMin: EthString.optional(),
  priceMax: EthString.optional(),
  sort: NftSort.default('recent'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(PAGE_SIZE_MAX)
    .default(NFT_PAGE_SIZE_DEFAULT),
})
export type NftListQuery = z.infer<typeof NftListQuery>
export type NftListQueryInput = z.input<typeof NftListQuery>

export const NftFacet = z.object({
  id: Id,
  name: z.string().min(1),
  count: Count,
})
export type NftFacet = z.infer<typeof NftFacet>

/**
 * Contagens para os filtros. Cada grupo respeita todos os filtros ativos, exceto o seu próprio,
 * para o usuário ver quantos itens teria ao marcar outra opção do mesmo grupo.
 * Lista todas as coleções e redes, inclusive com contagem zero.
 */
export const NftFacets = z.object({
  collections: z.array(NftFacet),
  networks: z.array(NftFacet),
})
export type NftFacets = z.infer<typeof NftFacets>

export const NftListResponse = paginated(Nft).extend({ facets: NftFacets })
export type NftListResponse = z.infer<typeof NftListResponse>

