import Decimal from 'decimal.js'
import type { EthString, Network } from '@/contracts'

/** Decimal isolado para o mock: precisão folgada, arredondamento para baixo (nunca cobra a mais). */
export const Eth = Decimal.clone({ precision: 60, rounding: Decimal.ROUND_DOWN })
export type Eth = InstanceType<typeof Eth>

/** Converte para string ETH válida: até 18 casas, sem notação exponencial, nunca negativa. */
export const toEthString = (value: Decimal.Value): EthString => {
  const d = Eth.max(new Eth(value), 0).toDecimalPlaces(18, Decimal.ROUND_DOWN)
  return d.toFixed()
}

/** PRNG determinístico (mulberry32). Usado só para gerar fixtures. */
export const createRng = (seed: number) => {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)],
  }
}

/** Hash hexadecimal determinístico e síncrono (FNV-1a encadeado). Não é criptográfico. */
export const deterministicHex = (input: string, length = 64) => {
  let out = ''
  let round = 0
  while (out.length < length) {
    let h = 0x811c9dc5 ^ round
    const text = `${round}:${input}`
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    out += (h >>> 0).toString(16).padStart(8, '0')
    round++
  }
  return out.slice(0, length)
}

const EXPLORERS: Record<Network, string> = {
  ethereum: 'https://etherscan.io/tx/',
  polygon: 'https://polygonscan.com/tx/',
  base: 'https://basescan.org/tx/',
}

export const transactionRefFor = (orderId: string, network: Network) => {
  const hash = `0x${deterministicHex(`tx:${orderId}`)}`
  return { hash, explorerUrl: `${EXPLORERS[network]}${hash}` }
}

/** JSON estável (chaves ordenadas), para comparar conteúdos. */
export const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** Remove acentos e caixa, para busca. */
export const normalizeText = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const v of Object.values(value)) deepFreeze(v)
  }
  return value
}
