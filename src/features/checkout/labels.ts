import type { Network, WalletType } from '@/contracts'

export const NETWORK_LABELS: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  base: 'Base',
}

/** Ordem do layout ("Carteira e rede"). */
export const PROVIDERS: readonly WalletType[] = ['WalletConnect', 'MetaMask', 'Coinbase Wallet']

export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`
