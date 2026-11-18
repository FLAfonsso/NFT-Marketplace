import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { NftUpdatedEvent, OrderUpdatedEvent, type RealtimeEvent } from '@/contracts'
import { sessionStore, useAuth } from '@/features/auth'
import { publishSynced, syncedListenerCount } from './bus'
import {
  applyNftUpdate,
  applyOrderUpdate,
  cachedOrder,
  latestCachedNft,
  reconcileWithApi,
} from './cacheSync'
import { onReconnect, onRealtimeEvent, openSocket, socketDiagnostics } from './socket'
import { VersionTracker, type EventVerdict } from './versions'

const debug = (verdict: EventVerdict | 'invalid' | 'other-user', event: unknown) => {
  if (import.meta.env.DEV) console.debug(`[realtime] descartado (${verdict})`, event)
}

/** Tracker da sessão atual, só para o diagnóstico em dev. */
let activeTracker: VersionTracker | null = null

/**
 * Liga o tempo real ao cache. Montado uma vez no layout raiz.
 *
 * - Visitante: socket sem token, só `nft.updated`. Autenticado: também `order.updated`.
 * - Cada evento é validado com o contrato e passa pelo controle de versão (duplicata, version
 *   antiga, version do cache). Eventos de pedido de outro usuário são ignorados.
 * - Aceito, o evento é aplicado ao cache e publicado no barramento (bus.ts), de onde as telas
 *   tiram seus efeitos (avisos, anúncios). Descartado, não faz nada.
 * - Reconexão depois de queda: zera o controle de versão e reconcilia pela API REST.
 * - Troca de sessão (login, logout, troca de usuário) reinicia o efeito: listeners removidos e
 *   Map de versões limpo. O socket da sessão anterior é fechado em features/auth/session.ts.
 */
export function useRealtimeSync() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const ready = auth.status !== 'loading'
  const userId = auth.status === 'authenticated' ? auth.user.id : null
  const token = auth.status === 'authenticated' ? auth.token : null

  useEffect(() => {
    if (!ready) return
    openSocket(token)

    const tracker = new VersionTracker()
    activeTracker = tracker
    /** O efeito pode sobreviver um instante à sessão (antes do re-render): confere sempre. */
    const sameSession = () => (sessionStore.getState().token ?? null) === token

    const accept = (event: RealtimeEvent, cachedVersion: number | undefined) => {
      const verdict = tracker.check(event, cachedVersion)
      if (verdict !== 'accept') {
        debug(verdict, event)
        return false
      }
      tracker.record(event)
      return true
    }

    const offNft = onRealtimeEvent('nft.updated', (raw) => {
      const parsed = NftUpdatedEvent.safeParse(raw)
      if (!parsed.success) return debug('invalid', raw)
      if (!sameSession()) return
      const event = parsed.data
      const previous = latestCachedNft(queryClient, event.resource.id, userId)
      if (!accept(event, previous?.version)) return
      applyNftUpdate(queryClient, event, userId)
      publishSynced('nft.updated', { event, previous })
    })

    const offOrder = userId
      ? onRealtimeEvent('order.updated', (raw) => {
          const parsed = OrderUpdatedEvent.safeParse(raw)
          if (!parsed.success) return debug('invalid', raw)
          const event = parsed.data
          // Evento privado só vale para o usuário desta sessão.
          if (!sameSession() || event.userId !== userId || sessionStore.getState().user?.id !== userId) {
            return debug('other-user', event)
          }
          const previous = cachedOrder(queryClient, userId, event.resource.id)
          if (!accept(event, previous?.version)) return
          applyOrderUpdate(queryClient, event, userId)
          publishSynced('order.updated', { event, previous })
        })
      : () => {}

    const offReconnect = onReconnect(() => {
      if (!sameSession()) return
      tracker.clear()
      reconcileWithApi(queryClient, userId)
    })

    return () => {
      offNft()
      offOrder()
      offReconnect()
      tracker.clear()
      if (activeTracker === tracker) activeTracker = null
    }
  }, [ready, token, userId, queryClient])
}

declare global {
  interface Window {
    /** Diagnóstico do tempo real (só em dev). */
    __realtime?: { diagnostics: () => unknown }
  }
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__realtime = {
    diagnostics: () => ({
      ...socketDiagnostics(),
      screenSubscriptions: syncedListenerCount(),
      trackedResources: activeTracker?.size ?? 0,
    }),
  }
}
