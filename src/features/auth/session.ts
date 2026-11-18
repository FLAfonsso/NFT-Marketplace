import type { LoginInput, RegisterInput, Session, User } from '@/contracts'
import { isApiRequestError, setTokenGetter } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import { closeSocket, openSocket } from '@/features/realtime/socket'
import { authApi } from './authApi'
import { tokenStorage } from './tokenStorage'

/**
 * Estado da sessão fora do React: o Axios (token, 401) e o Router (beforeLoad) leem daqui.
 * O AuthProvider só expõe este store para os componentes.
 */
export type SessionState =
  | { status: 'loading'; user: null; token: null }
  | { status: 'anonymous'; user: null; token: null }
  | { status: 'authenticated'; user: User; token: string }

let state: SessionState = { status: 'loading', user: null, token: null }
const subscribers = new Set<() => void>()

const setState = (next: SessionState) => {
  state = next
  subscribers.forEach((notify) => notify())
}

setTokenGetter(() => state.token)

/** Apaga tudo o que pertence à sessão anterior: cache, socket e listeners. */
const discardSessionData = () => {
  void queryClient.cancelQueries()
  queryClient.clear()
  closeSocket()
}

const applySession = (session: Session) => {
  if (state.user && state.user.id !== session.user.id) discardSessionData()
  tokenStorage.set(session.token)
  setState({ status: 'authenticated', user: session.user, token: session.token })
  openSocket(session.token)
}

/** Encerra localmente (logout, 401, token inválido). */
const endSession = () => {
  tokenStorage.clear()
  discardSessionData()
  setState({ status: 'anonymous', user: null, token: null })
}

let restoring: Promise<void> | null = null

export const sessionStore = {
  getState: () => state,

  subscribe(notify: () => void) {
    subscribers.add(notify)
    return () => {
      subscribers.delete(notify)
    }
  },

  /** Resolve quando a sessão sai de "loading". */
  whenReady(): Promise<SessionState> {
    if (state.status !== 'loading') return Promise.resolve(state)
    return new Promise((resolve) => {
      const unsubscribe = sessionStore.subscribe(() => {
        if (state.status === 'loading') return
        unsubscribe()
        resolve(state)
      })
    })
  },

  /** Recupera a sessão do token salvo (refresh, ou token trocado em outra aba). */
  restore(): Promise<void> {
    restoring ??= (async () => {
      const token = tokenStorage.get()
      if (!token) {
        if (state.status !== 'anonymous') endSession()
        return
      }
      if (state.status === 'authenticated' && state.token === token) return
      try {
        applySession(await authApi.session(token))
      } catch (error) {
        // 401: token inválido ou vencido. Outras falhas: segue anônimo, mas mantém o token
        // para a próxima tentativa (refresh).
        if (isApiRequestError(error) && error.code === 'unauthorized') endSession()
        else {
          discardSessionData()
          setState({ status: 'anonymous', user: null, token: null })
        }
      }
    })().finally(() => {
      restoring = null
    })
    return restoring
  },

  async login(input: LoginInput) {
    applySession(await authApi.login(input))
  },

  async register(input: RegisterInput) {
    applySession(await authApi.register(input))
  },

  async logout() {
    try {
      await authApi.logout()
    } catch {
      // Logout é local mesmo se a API falhar; o token some do cliente.
    } finally {
      endSession()
    }
  },

  /** Sessão recusada pela API durante o uso (401). */
  expire: endSession,
}
