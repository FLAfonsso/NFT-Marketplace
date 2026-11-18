import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from './context'
import { sessionStore } from './session'
import { TOKEN_STORAGE_KEY } from './tokenStorage'

export function AuthProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(sessionStore.subscribe, sessionStore.getState)

  useEffect(() => {
    void sessionStore.restore()

    // Login, logout ou troca de usuário em outra aba.
    const onStorage = (event: StorageEvent) => {
      if (event.key === TOKEN_STORAGE_KEY || event.key === null) void sessionStore.restore()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login: sessionStore.login,
      register: sessionStore.register,
      logout: sessionStore.logout,
    }),
    [state],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
