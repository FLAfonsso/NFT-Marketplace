import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useSocketStatus, type SocketStatus } from './socket'

/** Quanto tempo o aviso "Conexão restabelecida" fica na tela. */
const RESTORED_MS = 3_000

type Shown = 'reconnecting' | 'disconnected' | 'restored' | null

const TEXT: Record<Exclude<Shown, null>, string> = {
  reconnecting: 'Reconectando… as atualizações em tempo real voltam em instantes.',
  disconnected: 'Sem atualizações em tempo real.',
  restored: 'Conexão restabelecida.',
}

/**
 * Status da conexão em tempo real, discreto, no canto da tela. A região role="status" fica
 * sempre montada e vazia enquanto está tudo conectado (sem anúncios); só a queda, a tentativa
 * de reconexão e a volta são anunciadas.
 */
export function ConnectionIndicator() {
  const status = useSocketStatus()
  const [previous, setPrevious] = useState<SocketStatus>(status)
  const [restored, setRestored] = useState(false)

  if (status !== previous) {
    setPrevious(status)
    setRestored(status === 'connected' && (previous === 'reconnecting' || previous === 'disconnected'))
  }

  useEffect(() => {
    if (!restored) return
    const timer = setTimeout(() => setRestored(false), RESTORED_MS)
    return () => clearTimeout(timer)
  }, [restored])

  const shown: Shown =
    status === 'reconnecting' || status === 'disconnected' ? status : restored ? 'restored' : null

  return (
    <div
      role="status"
      className="pointer-events-none fixed bottom-24 left-4 z-50 md:bottom-4"
    >
      {shown && (
        <p
          className={cn(
            'flex items-center gap-2 rounded-full border bg-surface/95 px-3 py-1.5 text-xs shadow-sm backdrop-blur',
            shown === 'restored' ? 'border-border text-muted-foreground' : 'border-primary/50 text-foreground',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'size-2 rounded-full',
              shown === 'restored' && 'bg-emerald-500',
              shown === 'reconnecting' && 'animate-pulse bg-primary motion-reduce:animate-none',
              shown === 'disconnected' && 'bg-destructive',
            )}
          />
          {TEXT[shown]}
        </p>
      )}
    </div>
  )
}
