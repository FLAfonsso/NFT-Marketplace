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

export const NftImage = z.object({
  url: z.string().min(1),
  alt: z.string(),
})
export type NftImage = z.infer<typeof NftImage>

export const NftEdition = z.object({
  id: Id,
  name: z.string().min(1),
  supply: Quantity,
  /** Unidades disponíveis agora. Zero significa edição esgotada. */
  available: Count,
  /** Limite de unidades por pedido. */
  maxPerOrder: Quantity,
})
export type NftEdition = z.infer<typeof NftEdition>

export const Nft = z.object({
  id: Id,
  name: z.string().min(1),
  description: z.string(),
  creator: z.string().min(1),
  category: z.string().min(1),
  images: z.array(NftImage).min(1),
  price: EthString,
  editions: z.array(NftEdition).min(1),
  featured: z.boolean(),
  createdAt: IsoDateTime,
  version: Version,
})
export type Nft = z.infer<typeof Nft>

export const NFT_SORTS = ['recent', 'price_asc', 'price_desc', 'name_asc'] as const
export const NftSort = z.enum(NFT_SORTS)
export type NftSort = z.infer<typeof NftSort>

/** Aceita boolean (search params do Router) ou "true"/"false" (query string da URL). */
const BooleanParam = z.union([z.boolean(), z.stringbool()])

export const NftListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().min(1).optional(),
  minPrice: EthString.optional(),
  maxPrice: EthString.optional(),
  availableOnly: BooleanParam.optional(),
  sort: NftSort.default('recent'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(PAGE_SIZE_MAX).default(12),
})
export type NftListQuery = z.infer<typeof NftListQuery>
export type NftListQueryInput = z.input<typeof NftListQuery>

export const NftListResponse = paginated(Nft)
export type NftListResponse = z.infer<typeof NftListResponse>
