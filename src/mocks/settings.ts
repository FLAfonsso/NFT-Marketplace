/**
 * Parâmetros ajustáveis da simulação. Ficam só em memória e voltam ao padrão em reset().
 * Alterados por src/mocks/control.ts.
 */
export const DEFAULT_SETTINGS = {
  /** Latência fixa aplicada a toda resposta REST. */
  latencyMs: 150,
  /** Validade do token de sessão. */
  sessionTtlMs: 30 * 60_000,
  /** Validade de uma cotação. */
  quoteTtlMs: 5 * 60_000,
  /** Tempo até um pedido "pending" virar "confirmed" ou "rejected". */
  orderSettleMs: 2_500,
}

export type MockSettings = typeof DEFAULT_SETTINGS

export const mockSettings: MockSettings = { ...DEFAULT_SETTINGS }

export interface Fault {
  /** Método HTTP (maiúsculo). Ausente: qualquer método. */
  method?: string
  /** Trecho do caminho, ex.: "/api/orders". Ausente: qualquer rota. */
  path?: string
  /** Status 5xx devolvido, ou "network" para falha de conexão. */
  status: 500 | 502 | 503 | 504 | 'network'
  /** Quantas requisições afetar. */
  times: number
  /**
   * true: executa o handler (efeitos acontecem) e depois falha a resposta.
   * Simula timeout após criação do pedido, recuperável por idempotência.
   */
  afterHandler?: boolean
}

export const faults: Fault[] = []

export const resetSettings = () => {
  Object.assign(mockSettings, DEFAULT_SETTINGS)
  faults.length = 0
}
