import { Session, type LoginInput, type RegisterInput } from '@/contracts'
import { getGuestId } from '@/features/cart/guestId'
import { api, requestVoid } from '@/lib/api'

export const authApi = {
  /** O 401 aqui é tratado pela recuperação da sessão, não pelo fluxo global. */
  session: (token: string) =>
    api.get(Session, '/auth/session', {
      headers: { Authorization: `Bearer ${token}` },
      skipAuthRedirect: true,
    }),
  /** O id do carrinho de visitante vai junto para a API mesclar os itens no carrinho do usuário. */
  login: (input: LoginInput) =>
    api.post(Session, '/auth/login', input, { headers: { 'X-Guest-Cart-Id': getGuestId() } }),
  register: (input: RegisterInput) =>
    api.post(Session, '/auth/register', input, { headers: { 'X-Guest-Cart-Id': getGuestId() } }),
  logout: () => requestVoid({ method: 'POST', url: '/auth/logout', skipAuthRedirect: true }),
}
