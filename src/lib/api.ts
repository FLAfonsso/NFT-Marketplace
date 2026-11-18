import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'
import type { z } from 'zod'
import { ApiError, type ErrorCode } from '@/contracts'

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Não dispara o fluxo global de 401 (ex.: recuperação da sessão, que trata o 401 sozinha). */
    skipAuthRedirect?: boolean
  }
}

/**
 * Erro de qualquer chamada REST, já no formato ApiError do contrato.
 * - http: a API respondeu com erro (corpo ApiError validado);
 * - network: sem resposta (queda, timeout);
 * - contract: resposta fora do schema esperado.
 */
export class ApiRequestError extends Error implements ApiError {
  readonly code: ErrorCode
  readonly fieldErrors?: ApiError['fieldErrors']
  readonly status: number | null
  readonly kind: 'http' | 'network' | 'contract'

  constructor(
    error: ApiError,
    options: { status: number | null; kind: ApiRequestError['kind']; cause?: unknown },
  ) {
    super(error.message, { cause: options.cause })
    this.name = 'ApiRequestError'
    this.code = error.code
    this.fieldErrors = error.fieldErrors
    this.status = options.status
    this.kind = options.kind
  }

  /** Falha que pode dar certo numa nova tentativa. */
  get transient() {
    return this.kind === 'network' || this.code === 'transient'
  }
}

export const isApiRequestError = (error: unknown): error is ApiRequestError =>
  error instanceof ApiRequestError

const codeFromStatus = (status: number): ErrorCode => {
  if (status === 400 || status === 422) return 'validation'
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 409) return 'conflict'
  return 'transient'
}

function toApiRequestError(error: unknown): unknown {
  // Cancelamento (AbortSignal do Query) segue como está: o Query o reconhece.
  if (axios.isCancel(error) || !axios.isAxiosError(error)) return error
  const { response } = error
  if (!response) {
    return new ApiRequestError(
      { code: 'transient', message: 'Falha de conexão. Tente novamente.' },
      { status: null, kind: 'network', cause: error },
    )
  }
  const body = ApiError.safeParse(response.data)
  const apiError: ApiError = body.success
    ? body.data
    : { code: codeFromStatus(response.status), message: 'Erro inesperado na API.' }
  return new ApiRequestError(apiError, { status: response.status, kind: 'http', cause: error })
}

// ---------------------------------------------------------------------------
// Sessão: o token vem de fora (src/features/auth), sem acoplar este módulo ao React.
// ---------------------------------------------------------------------------

let getToken: () => string | null = () => null
let onUnauthorized: (() => void) | null = null

/** Fonte do token enviado em Authorization. */
export const setTokenGetter = (getter: () => string | null) => {
  getToken = getter
}

/** Chamado quando uma requisição autenticada recebe 401 com o token ainda vigente. */
export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  onUnauthorized = handler
}

export const http = axios.create({ baseURL: '/api', timeout: 15_000 })

http.interceptors.request.use((config) => {
  const token = getToken()
  if (token && !config.headers.has('Authorization')) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

http.interceptors.response.use(undefined, (error: unknown) => {
  if (axios.isAxiosError(error) && error.response?.status === 401 && error.config) {
    const sent = error.config.headers.get('Authorization')
    const current = getToken()
    // Só encerra se o 401 é do token atual (não de um token antigo ou de um login errado).
    if (!error.config.skipAuthRedirect && current && sent === `Bearer ${current}`) {
      onUnauthorized?.()
    }
  }
  return Promise.reject(toApiRequestError(error))
})

/** Valida a resposta com o schema do contrato. Fora do contrato vira ApiRequestError. */
function parse<S extends z.ZodType>(schema: S, response: AxiosResponse<unknown>): z.infer<S> {
  const result = schema.safeParse(response.data)
  if (!result.success) {
    if (import.meta.env.DEV) {
      console.error(`Resposta fora do contrato: ${response.config.url}`, result.error)
    }
    throw new ApiRequestError(
      { code: 'validation', message: 'Resposta da API fora do contrato.' },
      { status: response.status, kind: 'contract', cause: result.error },
    )
  }
  return result.data
}

/** Requisição com resposta validada pelo schema. */
export async function request<S extends z.ZodType>(
  schema: S,
  config: AxiosRequestConfig,
): Promise<z.infer<S>> {
  const response = await http.request<unknown>(config)
  return parse(schema, response)
}

/** Requisição sem corpo de resposta (204). */
export async function requestVoid(config: AxiosRequestConfig): Promise<void> {
  await http.request<unknown>(config)
}

export const api = {
  get: <S extends z.ZodType>(schema: S, url: string, config?: AxiosRequestConfig) =>
    request(schema, { ...config, method: 'GET', url }),
  post: <S extends z.ZodType>(
    schema: S,
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ) => request(schema, { ...config, method: 'POST', url, data }),
  put: <S extends z.ZodType>(schema: S, url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request(schema, { ...config, method: 'PUT', url, data }),
  patch: <S extends z.ZodType>(
    schema: S,
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ) => request(schema, { ...config, method: 'PATCH', url, data }),
  delete: <S extends z.ZodType>(schema: S, url: string, config?: AxiosRequestConfig) =>
    request(schema, { ...config, method: 'DELETE', url }),
}
