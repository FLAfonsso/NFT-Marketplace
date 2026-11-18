import Decimal from 'decimal.js'

/** Formato de ETH de docs/design/tokens.md: ponto, mínimo de 2 casas, sem zeros além disso. */
export function formatEth(value: string): string {
  const [int, frac = ''] = new Decimal(value).toFixed().split('.')
  const trimmed = frac.replace(/0+$/, '')
  return `${int}.${trimmed.padEnd(2, '0')}`
}
