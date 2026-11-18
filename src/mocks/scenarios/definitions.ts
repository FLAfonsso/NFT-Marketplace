import { delay, HttpResponse } from 'msw'
import { RegisterInput } from '@/contracts'
import { checkSession, expireSessions } from '../db/auth'
import { read, updateNft } from '../db/store'
import { deterministicHex, Eth, toEthString } from '../db/util'
import { API, errorResponse, IDEMPOTENCY_HEADER } from '../handlers/http'
import type { Scenario, ScenarioName, ScenarioRequest, ScenarioRuntime } from './types'

/**
 * Definição de cada cenário. Nada aqui usa Math.random: o que varia é derivado da seed
 * e de contadores do runtime, então a mesma sequência de requisições dá o mesmo resultado.
 * Documentação para quem usa: docs/SCENARIOS.md.
 */

const SLOW_MS = 3_000
const JITTER_MIN_MS = 100
const JITTER_MAX_MS = 2_500
const SERVER_FAILURES = 2
const SESSION_REQUESTS = 5
/** price-changed: o preço sobe 10 % entre a cotação e a confirmação. */
const PRICE_FACTOR = '1.1'

const isCreateOrder = (ctx: ScenarioRequest) => ctx.method === 'POST' && ctx.path === `${API}/orders`

/** Incrementa e devolve um contador do runtime. */
const bump = (runtime: ScenarioRuntime, key: string) => {
  const next = (typeof runtime[key] === 'number' ? runtime[key] : 0) + 1
  runtime[key] = next
  return next
}

/** Número em [0, 1) derivado da seed e da posição da requisição. */
const seeded = (seed: number, n: number) =>
  parseInt(deterministicHex(`jitter:${seed}:${n}`, 8), 16) / 2 ** 32

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Primeira linha da cotação de um POST /orders que criaria um pedido novo.
 * Repetições (chave de idempotência já usada) não disparam os gatilhos de compra.
 */
const quotedLineOf = async (ctx: ScenarioRequest) => {
  const key = ctx.request.headers.get(IDEMPOTENCY_HEADER)?.trim().toLowerCase()
  if (key && read().orders.some((r) => r.order.idempotencyKey === key)) return undefined
  const body = await ctx.json()
  const quoteId = isRecord(body) && typeof body.quoteId === 'string' ? body.quoteId : undefined
  return quoteId ? read().quotes[quoteId]?.quote.items[0] : undefined
}

/** Caminhos "a.b.0.c" de todos os valores primitivos de um corpo JSON. */
const leafPaths = (value: unknown, prefix = ''): string[] => {
  if (Array.isArray(value)) return value.flatMap((v, i) => leafPaths(v, `${prefix}${i}.`))
  if (isRecord(value)) return Object.entries(value).flatMap(([k, v]) => leafPaths(v, `${prefix}${k}.`))
  return prefix ? [prefix.slice(0, -1)] : []
}

const GUARDED_ID = /^\/api\/(orders|wallets)\/[^/]+$/
const NFT_DETAIL = /^\/api\/nfts\/[^/]+$/
/** client-errors não bloqueia entrar e sair, para dar para chegar aos formulários. */
const AUTH_FLOW = new Set([`${API}/auth/login`, `${API}/auth/logout`])

export const SCENARIOS: Record<ScenarioName, Scenario> = {
  default: {
    summary: 'Sucesso normal, com a latência padrão (mockSettings.latencyMs).',
  },

  empty: {
    summary: 'Catálogo, favoritos, carrinho, carteiras e pedidos vazios. Login continua funcionando.',
    data: { catalog: 'empty' },
  },

  slow: {
    summary: 'Toda resposta REST demora o mesmo tempo (padrão 3000 ms; opção latencyMs).',
    latencyMs: (ctx) => ctx.options.latencyMs ?? SLOW_MS,
  },

  jitter: {
    summary: `Latência entre ${JITTER_MIN_MS} e ${JITTER_MAX_MS} ms derivada da seed e da ordem da requisição; respostas chegam fora de ordem.`,
    latencyMs: (ctx) => {
      const n = bump(ctx.runtime, 'requests')
      return JITTER_MIN_MS + Math.floor(seeded(ctx.seed, n) * (JITTER_MAX_MS - JITTER_MIN_MS))
    },
  },

  offline: {
    summary: 'Toda requisição REST falha como erro de rede (HttpResponse.error()).',
    before: () => HttpResponse.error(),
  },

  'server-error': {
    summary:
      'As primeiras N chamadas de cada rota (padrão 2; opção failures) respondem 500 e 503 alternados; depois tudo volta ao normal.',
    before: (ctx) => {
      const attempt = bump(ctx.runtime, `${ctx.method} ${ctx.path}`)
      if (attempt > (ctx.options.failures ?? SERVER_FAILURES)) return undefined
      const status = attempt % 2 === 1 ? 500 : 503
      const response = errorResponse(
        'transient',
        `Falha transitória simulada (${attempt}ª tentativa). Tente novamente.`,
        undefined,
        status,
      )
      if (status === 503) response.headers.set('Retry-After', '1')
      return response
    },
  },

  'client-errors': {
    summary:
      'Detalhe de NFT responde 404; pedido e edição de carteira, 403; demais envios com corpo, 400 com fieldErrors em cada campo.',
    before: async (ctx) => {
      if (ctx.method === 'GET' && NFT_DETAIL.test(ctx.path)) {
        return errorResponse('not_found', 'NFT não encontrado.')
      }
      if ((ctx.method === 'GET' || ctx.method === 'PUT') && GUARDED_ID.test(ctx.path)) {
        return errorResponse('forbidden', 'Este recurso pertence a outro usuário.')
      }
      if (!['POST', 'PUT', 'PATCH'].includes(ctx.method) || AUTH_FLOW.has(ctx.path)) return undefined
      const fields = leafPaths(await ctx.json())
      if (fields.length === 0) return undefined
      return errorResponse(
        'validation',
        'Dados recusados pelo servidor.',
        Object.fromEntries(fields.map((f) => [f, ['Valor recusado pelo servidor']])),
      )
    },
  },

  'session-expired': {
    summary:
      'O token expira após N requisições autenticadas (padrão 5; opção afterRequests). Depois de entrar de novo, expira ao confirmar o pedido.',
    before: (ctx) => {
      if (!ctx.request.headers.has('authorization')) return undefined
      const check = checkSession(ctx.request)
      if (check.status !== 'ok') return undefined
      // A expiração é real: o handler responde 401 e as próximas chamadas também.
      const phase = ctx.runtime.phase ?? 'navigation'
      if (phase === 'navigation') {
        const count = bump(ctx.runtime, 'authenticated')
        if (count > (ctx.options.afterRequests ?? SESSION_REQUESTS)) {
          expireSessions(check.user.id)
          ctx.runtime.phase = 'checkout'
        }
      } else if (phase === 'checkout' && isCreateOrder(ctx)) {
        expireSessions(check.user.id)
        ctx.runtime.phase = 'done'
      }
      return undefined
    },
  },

  'register-conflict': {
    summary: 'Cadastro válido responde 409 (e-mail já existente) com fieldErrors.email.',
    before: async (ctx) => {
      if (ctx.method !== 'POST' || ctx.path !== `${API}/auth/register`) return undefined
      // Corpo inválido segue para o handler, que responde o 400 normal.
      if (!RegisterInput.safeParse(await ctx.json()).success) return undefined
      return errorResponse('conflict', 'Já existe uma conta com este e-mail.', {
        email: ['E-mail já cadastrado'],
      })
    },
  },

  'coupon-invalid': {
    summary: 'Nenhum cupom existe: a cotação devolve coupon.status "invalid" e desconto zero.',
    data: { coupons: 'none' },
  },

  'coupon-expired': {
    summary: 'Todos os cupons estão vencidos: a cotação devolve coupon.status "expired" e desconto zero.',
    data: { coupons: 'expired' },
  },

  'price-changed': {
    summary:
      'Na primeira confirmação de pedido, o preço do primeiro item sobe 10 % (nft.updated); o pedido responde 409 price_changed com a nova cotação.',
    before: async (ctx) => {
      if (!isCreateOrder(ctx) || ctx.runtime.triggered) return undefined
      const line = await quotedLineOf(ctx)
      if (!line) return undefined
      ctx.runtime.triggered = true
      updateNft(line.nftId, (nft) => {
        nft.price = toEthString(new Eth(nft.price).mul(PRICE_FACTOR))
      })
      return undefined
    },
  },

  'sold-out': {
    summary:
      'Na primeira confirmação de pedido, a edição do primeiro item esgota (nft.updated); o pedido responde 409 sold_out.',
    before: async (ctx) => {
      if (!isCreateOrder(ctx) || ctx.runtime.triggered) return undefined
      const line = await quotedLineOf(ctx)
      if (!line) return undefined
      ctx.runtime.triggered = true
      updateNft(line.nftId, (nft) => {
        const edition = nft.editions.find((e) => e.id === line.editionId)
        if (edition) edition.available = 0
      })
      return undefined
    },
  },

  'order-timeout': {
    summary:
      'Todo pedido novo é criado, mas a resposta 201 nunca chega; reenviar com a mesma Idempotency-Key devolve 200 com o mesmo pedido.',
    after: async (ctx, response) => {
      if (isCreateOrder(ctx) && response.status === 201) await delay('infinite')
      return response
    },
  },

  'payment-confirmed': {
    summary: 'Todo pedido pendente é confirmado, inclusive com carteira terminada em "dead".',
    settlement: 'confirmed',
  },

  'payment-rejected': {
    summary: 'Todo pedido pendente é recusado e o estoque reservado é devolvido.',
    settlement: 'rejected',
  },
}
