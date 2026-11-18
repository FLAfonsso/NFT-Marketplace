import { z } from 'zod'

/**
 * Valor em ETH como string decimal não negativa, com até 18 casas (precisão de wei).
 * Nunca trafega como number. Cálculos devem usar decimal.js.
 */
export const ETH_STRING_REGEX = /^(0|[1-9]\d*)(\.\d{1,18})?$/

export const EthString = z
  .string()
  .regex(ETH_STRING_REGEX, 'Valor em ETH deve ser uma string decimal válida')
export type EthString = z.infer<typeof EthString>

/** Quantidade de itens: inteiro positivo. */
export const Quantity = z.number().int().positive()
export type Quantity = z.infer<typeof Quantity>

/** Contagem que pode ser zero (ex.: disponibilidade de estoque). */
export const Count = z.number().int().nonnegative()
export type Count = z.infer<typeof Count>

/** Versão monotônica de um recurso, usada para descartar dados e eventos antigos. */
export const Version = z.number().int().nonnegative()
export type Version = z.infer<typeof Version>

export const Id = z.string().min(1)
export type Id = z.infer<typeof Id>

export const IsoDateTime = z.iso.datetime()
export type IsoDateTime = z.infer<typeof IsoDateTime>

export const ERROR_CODES = [
  'validation',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'transient',
] as const

export const ErrorCode = z.enum(ERROR_CODES)
export type ErrorCode = z.infer<typeof ErrorCode>

export const ApiError = z.object({
  code: ErrorCode,
  message: z.string(),
  /** Erros por campo, chaveados pelo caminho do campo (ex.: "email", "items.0.quantity"). */
  fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
})
export type ApiError = z.infer<typeof ApiError>

export const PAGE_SIZE_MAX = 48

/** Envelope de resposta paginada. */
export const paginated = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    page: Quantity,
    pageSize: Quantity.max(PAGE_SIZE_MAX),
    total: Count,
    totalPages: Count,
  })
