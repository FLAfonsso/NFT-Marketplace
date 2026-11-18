import Decimal from 'decimal.js'

/** Hash abreviado do layout: 0xA91F…E82C. O hash completo continua no title do elemento. */
export const shortHash = (hash: string) => `${hash.slice(0, 6)}…${hash.slice(-4)}`

/** Data do recibo em pt-BR no formato do layout: "29 Jul, 2026". */
export function formatReceiptDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const parts = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  const month = get('month').replace('.', '')
  return `${get('day')} ${month.charAt(0).toUpperCase()}${month.slice(1)}, ${get('year')}`
}

/**
 * ID do token a partir do snapshot do pedido (o nome grava "#042"; o layout usa 4 dígitos,
 * docs/design/screens.md, inconsistência 2). Nunca consulta o catálogo atual.
 */
export function tokenLabel(item: { nftName: string; nftId: string }): string {
  const match = /#(\d+)\s*$/.exec(item.nftName)
  return match ? `#${match[1].padStart(4, '0')}` : item.nftId
}

export const hasDiscount = (discount: string) => new Decimal(discount).gt(0)

/** Só abre links http(s): a referência vem da API e vai para um href. */
export function safeExplorerUrl(url: string): string | null {
  try {
    const { protocol } = new URL(url)
    return protocol === 'https:' || protocol === 'http:' ? url : null
  } catch {
    return null
  }
}
