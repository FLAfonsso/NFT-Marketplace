import { createContext, useContext, useEffect } from 'react'

/**
 * Ponte entre as telas da conta e o layout: a tela diz se há mudanças pendentes e o layout
 * (que tem a lateral com "Sair" e o diálogo) decide se avisa antes de sair.
 */
export interface ExitGuard {
  setDirty: (dirty: boolean) => void
}

export const ExitGuardContext = createContext<ExitGuard | null>(null)

/** Registra se a tela tem mudanças não salvas. Ao sair de cena, volta a "sem mudanças". */
export function useUnsavedChanges(dirty: boolean) {
  const guard = useContext(ExitGuardContext)
  if (!guard) throw new Error('useUnsavedChanges precisa estar dentro de <AccountLayout>')
  const { setDirty } = guard
  useEffect(() => {
    setDirty(dirty)
    return () => setDirty(false)
  }, [dirty, setDirty])
}
