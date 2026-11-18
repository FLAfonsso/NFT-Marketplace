import { HttpResponse, type HttpResponseResolver, type PathParams } from 'msw'
import type { z } from 'zod'
import type { ApiError, ErrorCode } from '@/contracts'
import { checkSession } from '../db/auth'
import { guestCartKey, userCartKey } from '../db/store'
import type { CartKey } from '../db/types'
import { withScenario } from '../scenarios'
import { faults, type Fault } from '../settings'
import { errorResponse } from './http'

export { API, errorResponse, IDEMPOTENCY_HEADER, jsonError } from './http'

/** Interrompe o handler com um ApiError. O MSW usa a Response lançada como resposta. */
export const fail = (
  code: ErrorCode,
  message: string,
  fieldErrors?: ApiError['fieldErrors'],
): never => {
  throw errorResponse(code, message, fieldErrors)
}

/** Converte issues do Zod em fieldErrors chaveados pelo caminho ("items.0.quantity"). */
export const toFieldErrors = (error: z.ZodError) => {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || '_root'
    ;(fieldErrors[key] ??= []).push(issue.message)
  }
  return fieldErrors
}

export const parseWith = <S extends z.ZodType>(schema: S, data: unknown): z.infer<S> => {
  const result = schema.safeParse(data)
  if (!result.success) {
    return fail('validation', 'Dados inválidos.', toFieldErrors(result.error))
  }
  return result.data
}

export const parseBody = async <S extends z.ZodType>(request: Request, schema: S) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail('validation', 'Corpo da requisição deve ser JSON válido.')
  }
  return parseWith(schema, body)
}

export const param = (params: PathParams, name: string) => {
  const value = params[name]
  return Array.isArray(value) ? String(value[0]) : String(value ?? '')
}

/** Exige sessão válida. 401 para ausente, inválida ou expirada. */
export const requireUser = (request: Request) => {
  const check = checkSession(request)
  switch (check.status) {
    case 'ok':
      return check
    case 'expired':
      return fail('unauthorized', 'Sessão expirada. Entre novamente.')
    case 'missing':
      return fail('unauthorized', 'Autenticação necessária.')
    default:
      return fail('unauthorized', 'Sessão inválida. Entre novamente.')
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const GUEST_CART_HEADER = 'X-Guest-Cart-Id'

/** Identificador opcional do carrinho de visitante (UUID gerado pelo cliente). */
export const guestIdFrom = (request: Request) => {
  const raw = request.headers.get(GUEST_CART_HEADER)
  if (raw === null) return null
  if (!UUID.test(raw)) {
    return fail('validation', `${GUEST_CART_HEADER} deve ser um UUID.`, {
      [GUEST_CART_HEADER]: ['UUID inválido'],
    })
  }
  return raw.toLowerCase()
}

/**
 * Quem está agindo: usuário autenticado ou visitante identificado pelo cabeçalho.
 * Com Authorization presente, a sessão precisa ser válida (não cai para visitante).
 */
export const resolveActor = (
  request: Request,
): { key: CartKey; userId: string | null } => {
  if (request.headers.has('authorization')) {
    const { user } = requireUser(request)
    return { key: userCartKey(user.id), userId: user.id }
  }
  const guestId = guestIdFrom(request)
  if (!guestId) {
    return fail('unauthorized', `Autentique-se ou envie o cabeçalho ${GUEST_CART_HEADER}.`)
  }
  return { key: guestCartKey(guestId), userId: null }
}

const takeFault = (request: Request, phase: 'before' | 'after'): Fault | undefined => {
  const { pathname } = new URL(request.url)
  const index = faults.findIndex(
    (f) =>
      Boolean(f.afterHandler) === (phase === 'after') &&
      (!f.method || f.method.toUpperCase() === request.method) &&
      (!f.path || pathname.includes(f.path)),
  )
  if (index < 0) return undefined
  const fault = faults[index]
  fault.times -= 1
  if (fault.times <= 0) faults.splice(index, 1)
  return fault
}

const faultResponse = (fault: Fault) =>
  fault.status === 'network'
    ? HttpResponse.error()
    : errorResponse(
        'transient',
        'Serviço temporariamente indisponível. Tente novamente.',
        undefined,
        fault.status,
      )

type Info = Parameters<HttpResponseResolver>[0]

/**
 * Envolve um resolver com o cenário ativo (latência, falhas e regras de src/mocks/scenarios),
 * as falhas injetadas por failNext (src/mocks/control.ts) e a conversão de erros inesperados
 * em 500 transitório. Todo handler passa por aqui.
 */
export const route = (
  resolver: (info: Info) => Response | Promise<Response>,
): HttpResponseResolver =>
  withScenario(async (info) => {
    const before = takeFault(info.request, 'before')
    if (before) return faultResponse(before)

    let response: Response
    try {
      response = await resolver(info)
    } catch (error) {
      if (error instanceof Response) response = error
      else {
        console.error('[mocks] erro inesperado no handler', error)
        response = errorResponse('transient', 'Erro interno simulado.', undefined, 500)
      }
    }

    const after = takeFault(info.request, 'after')
    return after ? faultResponse(after) : response
  })

export const noContent = () => new HttpResponse(null, { status: 204 })
