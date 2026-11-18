import { parseSearchWith, stringifySearchWith } from '@tanstack/react-router'

/**
 * Serialização de search params: igual à padrão (JSON), exceto que números não inteiros
 * continuam string. Assim "minPrice=0.123456789012345678" nunca passa por float e valores
 * em ETH ficam como string decimal; "page=2" continua number.
 */
const parseValue = (value: string): unknown => {
  const parsed: unknown = JSON.parse(value)
  if (typeof parsed === 'number' && !Number.isSafeInteger(parsed)) {
    throw new Error('Número não inteiro fica como string')
  }
  return parsed
}

export const parseSearch = parseSearchWith(parseValue)
export const stringifySearch = stringifySearchWith(JSON.stringify, parseValue)
