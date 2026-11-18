import type { SettlementOutcome } from '../db/store'

export const SCENARIO_NAMES = [
  'default',
  'empty',
  'slow',
  'jitter',
  'offline',
  'server-error',
  'client-errors',
  'session-expired',
  'register-conflict',
  'coupon-invalid',
  'coupon-expired',
  'price-changed',
  'sold-out',
  'order-timeout',
  'payment-confirmed',
  'payment-rejected',
] as const

export type ScenarioName = (typeof SCENARIO_NAMES)[number]

/** Parâmetros opcionais de setScenario. Inteiros não negativos; ausentes usam o padrão. */
export interface ScenarioOptions {
  /** slow: latência fixa em ms (padrão 3000). */
  latencyMs?: number
  /** server-error: falhas por rota antes de voltar ao normal (padrão 2). */
  failures?: number
  /** session-expired: requisições autenticadas até o token expirar na navegação (padrão 5). */
  afterRequests?: number
}

export const SCENARIO_OPTION_KEYS = ['latencyMs', 'failures', 'afterRequests'] as const satisfies
  readonly (keyof ScenarioOptions)[]

/**
 * Estado de execução do cenário (contadores, gatilhos já disparados).
 * Persistido junto com o cenário e zerado a cada setScenario.
 */
export type ScenarioRuntime = Record<string, number | boolean | string>

/** Requisição vista por um cenário. */
export interface ScenarioRequest {
  request: Request
  method: string
  /** pathname, ex.: "/api/orders". */
  path: string
  seed: number
  options: ScenarioOptions
  runtime: ScenarioRuntime
  /** Corpo JSON (de um clone; não consome a requisição). undefined se ausente ou inválido. */
  json: () => Promise<unknown>
}

/** Estado do banco exigido pelo cenário. Aplicado de forma idempotente. */
export interface ScenarioData {
  /** empty: catálogo, favoritos, carrinhos, carteiras e pedidos vazios. */
  catalog?: 'seed' | 'empty'
  /** none: nenhum cupom existe; expired: todos vencidos. */
  coupons?: 'seed' | 'none' | 'expired'
}

type MaybePromise<T> = T | Promise<T>

export interface Scenario {
  /** Efeito em uma frase (listScenarios e docs/SCENARIOS.md). */
  summary: string
  data?: ScenarioData
  /** Resultado forçado da liquidação dos pedidos pendentes. */
  settlement?: SettlementOutcome
  /** Latência da requisição em ms. Ausente: mockSettings.latencyMs. */
  latencyMs?: (ctx: ScenarioRequest) => number
  /** Antes do handler. Devolver uma Response encerra a requisição sem executar o handler. */
  before?: (ctx: ScenarioRequest) => MaybePromise<Response | undefined>
  /** Depois do handler (efeitos já aplicados). Pode trocar ou segurar a resposta. */
  after?: (ctx: ScenarioRequest, response: Response) => MaybePromise<Response>
}
