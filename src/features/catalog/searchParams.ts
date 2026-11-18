import Decimal from 'decimal.js'
import { z } from 'zod'
import { EthString, Id, Network, NftSort, NftView } from '@/contracts'
import { normalizeRange } from './list/price'

/**
 * ETH na URL: string decimal. O router converte "11.5" digitado à mão em número, então um número
 * não negativo também vale e volta a ser string decimal (sem conta em float).
 */
const EthParam = z.union([
  EthString,
  z
    .number()
    .nonnegative()
    .finite()
    .transform((n) => new Decimal(n).toFixed()),
])

/**
 * Search params da tela inicial. Valor inválido na URL cai no padrão em vez de quebrar a rota
 * (.catch), para links antigos ou editados à mão continuarem abrindo.
 */
export const catalogSearchSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  view: NftView.default('all').catch('all'),
  collections: z.array(Id).default([]).catch([]),
  networks: z.array(Network).default([]).catch([]),
  priceMin: EthParam.optional().catch(undefined),
  priceMax: EthParam.optional().catch(undefined),
  sort: NftSort.default('recent').catch('recent'),
  page: z.number().int().positive().default(1).catch(1),
}).transform((search) => ({ ...search, ...normalizeRange(search.priceMin, search.priceMax) }))

export type CatalogSearch = z.infer<typeof catalogSearchSchema>

/** Valores que não aparecem na URL (stripSearchParams). */
export const catalogSearchDefaults = {
  view: 'all',
  collections: [],
  networks: [],
  sort: 'recent',
  page: 1,
} as const satisfies Partial<CatalogSearch>
