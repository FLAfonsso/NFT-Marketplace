import { createContext, useContext } from 'react'
import type { SessionState, sessionStore } from './session'

export type AuthContextValue = SessionState & {
  login: typeof sessionStore.login
  register: typeof sessionStore.register
  logout: typeof sessionStore.logout
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return value
}
