import { z } from 'zod'
import { EthString, Id, Network, NftSort, NftView } from '@/contracts'

/** ETH na URL: string decimal; inteiro digitado à mão ("priceMin=2") também vale. */
const EthParam = z.union([EthString, z.number().int().nonnegative().transform(String)])

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
})

export type CatalogSearch = z.infer<typeof catalogSearchSchema>

/** Valores que não aparecem na URL (stripSearchParams). */
export const catalogSearchDefaults = {
  view: 'all',
  collections: [],
  networks: [],
  sort: 'recent',
  page: 1,
} as const satisfies Partial<CatalogSearch>
