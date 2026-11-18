import Decimal from 'decimal.js'

/** Faixa de preço do filtro (docs/design/screens.md). Sempre string decimal. */
export const PRICE_MIN = '0.02'
export const PRICE_MAX = '12.30'

/**
 * O slider trabalha em passos inteiros de 0.01 ETH (centésimos). O passo é só a posição da
 * alça: a conversão de ida e volta passa pelo decimal.js e o valor que vai para a URL é string.
 */
const STEPS_PER_ETH = 100

export const stepFromEth = (eth: string): number =>
  new Decimal(eth).times(STEPS_PER_ETH).toDecimalPlaces(0).toNumber()

export const ethFromStep = (step: number): string =>
  new Decimal(step).div(STEPS_PER_ETH).toFixed(2)

export const SLIDER_MIN = stepFromEth(PRICE_MIN)
export const SLIDER_MAX = stepFromEth(PRICE_MAX)

const clampStep = (step: number) => Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, step))

/** Posição das alças para os valores da URL (ausente = limite da faixa). */
export const stepsFrom = (min: string | undefined, max: string | undefined): [number, number] => [
  clampStep(stepFromEth(min ?? PRICE_MIN)),
  clampStep(stepFromEth(max ?? PRICE_MAX)),
]

/**
 * Normaliza a faixa vinda da URL: limita a 0.02–12.30, troca as pontas se min > max e remove
 * o que coincide com o limite da faixa (faixa completa = sem filtro). Tudo com decimal.js.
 */
export const normalizeRange = (
  min: string | undefined,
  max: string | undefined,
): { priceMin?: string; priceMax?: string } => {
  const clamp = (v: Decimal) => Decimal.min(Decimal.max(v, PRICE_MIN), PRICE_MAX)
  let lo = clamp(new Decimal(min ?? PRICE_MIN))
  let hi = clamp(new Decimal(max ?? PRICE_MAX))
  if (lo.gt(hi)) [lo, hi] = [hi, lo]
  return {
    priceMin: lo.eq(PRICE_MIN) ? undefined : lo.toFixed(),
    priceMax: hi.eq(PRICE_MAX) ? undefined : hi.toFixed(),
  }
}

/** Valor para a URL: o limite da faixa vira "sem filtro". */
export const paramFromStep = (step: number, bound: 'min' | 'max'): string | undefined => {
  const eth = ethFromStep(step)
  return eth === (bound === 'min' ? PRICE_MIN : PRICE_MAX) ? undefined : eth
}
