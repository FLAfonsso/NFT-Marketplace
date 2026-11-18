import { useCallback, useEffect, useRef, useState } from 'react'
import type { WalletConnection, WalletType } from '@/contracts'
import { isApiRequestError } from '@/lib/api'
import { checkoutApi } from './checkoutApi'

/**
 * Conexão simulada da carteira (POST /wallets/:id/connect no mock).
 * - idle: desconectada, nunca conectou nesta tela;
 * - connecting → connected | rejected (recusa vem do cenário wallet-rejected) | failed (rede, 5xx);
 * - disconnected: o usuário desconectou (ou trocou carteira/provedor).
 */
export type WalletConnectionState =
  | { status: 'idle' }
  | { status: 'connecting'; walletId: string; provider: WalletType }
  | { status: 'connected'; connection: WalletConnection }
  | { status: 'rejected'; message: string }
  | { status: 'failed'; message: string }
  | { status: 'disconnected' }

export function useWalletConnection(walletId: string, provider: WalletType | null) {
  const [state, setState] = useState<WalletConnectionState>({ status: 'idle' })
  const controller = useRef<AbortController | null>(null)

  useEffect(() => () => controller.current?.abort(), [])

  const connect = useCallback(async () => {
    if (!walletId || !provider) return
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    setState({ status: 'connecting', walletId, provider })
    try {
      const connection = await checkoutApi.connectWallet(walletId, provider, current.signal)
      if (!current.signal.aborted) setState({ status: 'connected', connection })
    } catch (error) {
      if (current.signal.aborted) return
      if (isApiRequestError(error) && error.code === 'forbidden') {
        setState({ status: 'rejected', message: error.message })
      } else {
        setState({
          status: 'failed',
          message: isApiRequestError(error) ? error.message : 'Não foi possível conectar.',
        })
      }
    }
  }, [walletId, provider])

  const disconnect = useCallback(() => {
    controller.current?.abort()
    setState({ status: 'disconnected' })
  }, [])

  // A conexão vale só para a carteira e o provedor escolhidos. Trocou: conta como desconectada.
  const stale =
    (state.status === 'connected' &&
      (state.connection.walletId !== walletId || state.connection.provider !== provider)) ||
    (state.status === 'connecting' && (state.walletId !== walletId || state.provider !== provider))
  const effective: WalletConnectionState = stale ? { status: 'disconnected' } : state

  return {
    state: effective,
    connection: effective.status === 'connected' ? effective.connection : null,
    connect,
    disconnect,
  }
}
