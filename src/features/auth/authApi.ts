import { Session, type LoginInput, type RegisterInput } from '@/contracts'
import { api, requestVoid } from '@/lib/api'

export const authApi = {
  /** O 401 aqui é tratado pela recuperação da sessão, não pelo fluxo global. */
  session: (token: string) =>
    api.get(Session, '/auth/session', {
      headers: { Authorization: `Bearer ${token}` },
      skipAuthRedirect: true,
    }),
  login: (input: LoginInput) => api.post(Session, '/auth/login', input),
  register: (input: RegisterInput) => api.post(Session, '/auth/register', input),
  logout: () => requestVoid({ method: 'POST', url: '/auth/logout', skipAuthRedirect: true }),
}
