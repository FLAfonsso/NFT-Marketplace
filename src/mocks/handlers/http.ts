import { HttpResponse } from 'msw'
import type { ApiError, ErrorCode } from '@/contracts'

/**
 * Primitivas HTTP sem dependências internas. Usadas pelos handlers e pelos cenários
 * (src/mocks/scenarios) sem criar ciclo de importação com handlers/utils.
 */

export const API = '/api'
export const IDEMPOTENCY_HEADER = 'Idempotency-Key'

export const STATUS_BY_CODE: Record<ErrorCode, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  transient: 503,
}

/** Responde um ApiError ou uma extensão dele (ex.: OrderConflict). */
export const jsonError = <T extends ApiError>(body: T, status = STATUS_BY_CODE[body.code]) =>
  HttpResponse.json<T>(body, { status })

export const errorResponse = (
  code: ErrorCode,
  message: string,
  fieldErrors?: ApiError['fieldErrors'],
  status = STATUS_BY_CODE[code],
) => jsonError<ApiError>({ code, message, ...(fieldErrors ? { fieldErrors } : {}) }, status)
