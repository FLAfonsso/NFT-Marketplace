import { delay, type HttpResponseResolver } from 'msw'
import {
  forceSettlementOutcome,
  read,
  rescheduleSettlements,
  reset as resetDb,
  transact,
} from '../db/store'
import { resetRealtime } from '../realtime/socket'
import { mockSettings } from '../settings'
import { applyScenarioData, needsDataSync } from './data'
import { SCENARIOS } from './definitions'
import {
  SCENARIO_NAMES,
  SCENARIO_OPTION_KEYS,
  type ScenarioName,
  type ScenarioOptions,
  type ScenarioRequest,
  type ScenarioRuntime,
} from './types'

export { SCENARIO_NAMES, type ScenarioName, type ScenarioOptions } from './types'

/**
 * Registro e estado dos cenários de rede e falha.
 *
 * - O cenário ativo e a seed ficam no localStorage e sobrevivem ao refresh.
 * - Seleção inicial: ?scenario=nome (e ?seed=n) na URL; senão o localStorage; senão "default".
 * - Todo handler passa por withScenario (via route, em handlers/utils.ts).
 * - Controle manual: window.__mocks (src/mocks/control.ts). Documentação: docs/SCENARIOS.md.
 */

const STORAGE_KEY = 'nft-marketplace:mocks:scenario'
const DEFAULT_SEED = 1

export interface ScenarioState {
  name: ScenarioName
  /** Seed da latência variável (cenário jitter). */
  seed: number
  options: ScenarioOptions
  runtime: ScenarioRuntime
}

const isScenarioName = (value: unknown): value is ScenarioName =>
  typeof value === 'string' && (SCENARIO_NAMES as readonly string[]).includes(value)

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

const parseCount = (raw: string | null) => {
  const n = raw === null || raw.trim() === '' ? NaN : Number(raw)
  return isCount(n) ? n : undefined
}

const sanitizeOptions = (raw: unknown): ScenarioOptions => {
  const options: ScenarioOptions = {}
  if (typeof raw !== 'object' || raw === null) return options
  for (const key of SCENARIO_OPTION_KEYS) {
    const value = (raw as Record<string, unknown>)[key]
    if (isCount(value)) options[key] = value
  }
  return options
}

const fresh = (name: ScenarioName = 'default', seed = DEFAULT_SEED, options: ScenarioOptions = {}): ScenarioState => ({
  name,
  seed,
  options,
  runtime: {},
})

const readStorage = (): ScenarioState | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ScenarioState>
    if (!isScenarioName(parsed.name)) return null
    const runtime =
      typeof parsed.runtime === 'object' && parsed.runtime !== null ? parsed.runtime : {}
    return {
      name: parsed.name,
      seed: isCount(parsed.seed) ? parsed.seed : DEFAULT_SEED,
      options: sanitizeOptions(parsed.options),
      runtime,
    }
  } catch {
    return null
  }
}

const writeStorage = (value: ScenarioState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch (error) {
    console.warn('[mocks] não foi possível persistir o cenário', error)
  }
}

const fromUrl = (): { name?: ScenarioName; seed?: number } => {
  if (typeof window === 'undefined') return {}
  const params = new URLSearchParams(window.location.search)
  const raw = params.get('scenario')
  if (raw !== null && !isScenarioName(raw)) {
    console.warn(`[mocks] cenário desconhecido na URL: "${raw}". Disponíveis: ${SCENARIO_NAMES.join(', ')}`)
  }
  return { name: isScenarioName(raw) ? raw : undefined, seed: parseCount(params.get('seed')) }
}

const initialState = (): ScenarioState => {
  const stored = readStorage()
  const url = fromUrl()
  // Cenário diferente na URL começa do zero; o mesmo cenário mantém o runtime (refresh).
  if (url.name && url.name !== stored?.name) return fresh(url.name, url.seed)
  if (!stored) return fresh('default', url.seed)
  if (url.seed !== undefined && url.seed !== stored.seed) return { ...stored, seed: url.seed, runtime: {} }
  return stored
}

let state = initialState()

/** Leva banco e liquidação ao que o cenário ativo exige. Idempotente. */
const sync = () => {
  writeStorage(state)
  const scenario = SCENARIOS[state.name]
  forceSettlementOutcome(scenario.settlement ?? null)
  if (needsDataSync(read(), scenario.data)) {
    transact((db, tx) => applyScenarioData(db, scenario.data, tx.now))
    rescheduleSettlements()
  }
}

sync()

// ---------------------------------------------------------------------------
// Controle (exposto em window.__mocks)
// ---------------------------------------------------------------------------

export interface ScenarioInfo {
  name: ScenarioName
  summary: string
}

export const listScenarios = (): ScenarioInfo[] =>
  SCENARIO_NAMES.map((name) => ({ name, summary: SCENARIOS[name].summary }))

/** Cenário ativo, seed, opções e runtime (cópia). */
export const getScenario = () => ({
  ...structuredClone(state),
  summary: SCENARIOS[state.name].summary,
})

/**
 * Ativa um cenário do zero (runtime zerado), mesmo que já seja o ativo.
 * Sem `seed`, usa a seed padrão (1), para o resultado não depender do que veio antes.
 */
export const setScenario = (name: ScenarioName, options: ScenarioOptions & { seed?: number } = {}) => {
  if (!isScenarioName(name)) {
    throw new Error(`Cenário desconhecido: "${String(name)}". Disponíveis: ${SCENARIO_NAMES.join(', ')}`)
  }
  const { seed, ...rest } = options
  state = fresh(name, isCount(seed) ? seed : DEFAULT_SEED, sanitizeOptions(rest))
  sync()
  return getScenario()
}

/**
 * Restaura o banco do seed (com as versions do seed), as configurações padrão e o cenário
 * "default". No tempo real, fecha as conexões, sai de uma queda simulada e esquece o histórico.
 */
export const reset = () => {
  resetDb()
  resetRealtime()
  state = fresh()
  sync()
  return getScenario()
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

type Info = Parameters<HttpResponseResolver>[0]

/**
 * Aplica o cenário ativo a um resolver: latência, gatilhos antes do handler (que podem
 * responder no lugar dele) e ajustes depois. Único ponto em que os handlers consultam o cenário.
 */
export const withScenario =
  (resolver: (info: Info) => Promise<Response>): HttpResponseResolver =>
  async (info) => {
    const scenario = SCENARIOS[state.name]
    let body: Promise<unknown> | undefined
    const ctx: ScenarioRequest = {
      request: info.request,
      method: info.request.method,
      path: new URL(info.request.url).pathname,
      seed: state.seed,
      options: state.options,
      runtime: state.runtime,
      json: () => {
        if (!body) {
          try {
            body = info.request.clone().json().catch(() => undefined)
          } catch {
            body = Promise.resolve(undefined)
          }
        }
        return body
      },
    }

    const latency = scenario.latencyMs?.(ctx) ?? mockSettings.latencyMs
    if (latency > 0) await delay(latency)

    const early = await scenario.before?.(ctx)
    // Contadores e gatilhos mudam só até aqui; persiste antes de uma resposta que pode não voltar.
    writeStorage(state)
    if (early) return early

    const response = await resolver(info)
    return scenario.after ? scenario.after(ctx, response) : response
  }
