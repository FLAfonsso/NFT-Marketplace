import { useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { safeRedirect } from '../redirect'
import type { FormAlert } from '../forms/applyApiError'

/**
 * Parte comum dos dois formulários: aviso do topo, trava contra envio duplicado e o que
 * acontece depois de entrar (invalidar queries da sessão e ir para o redirect seguro).
 */
export function useAuthSubmit(
  redirect: string | undefined,
  /** Leva o erro para os campos e devolve o aviso do topo, se sobrar algum. */
  onError: (error: unknown) => FormAlert | null,
) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [alert, setAlert] = useState<FormAlert | null>(null)
  const inFlight = useRef(false)

  const run = async (perform: () => Promise<void>) => {
    if (inFlight.current) return
    inFlight.current = true
    setAlert(null)
    try {
      await perform()
    } catch (error) {
      setAlert(onError(error))
      inFlight.current = false
      return
    }
    void queryClient.invalidateQueries()
    await navigate({ href: safeRedirect(redirect), replace: true })
    inFlight.current = false
  }

  return { alert, run }
}
