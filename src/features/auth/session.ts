import type { LoginInput, RegisterInput, Session, User } from '@/contracts'
import { isApiRequestError, setTokenGetter } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import { queryKeys } from '@/lib/queryKeys'
import { closeSocket, openSocket } from '@/features/realtime/socket'
import { allowPrivateData, clearOtherUsersPrivateData, clearUserPrivateData } from '@/lib/privateStorage'
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
  const previousId = state.user?.id
  if (previousId && previousId !== session.user.id) {
    // Troca de usuário sem logout: nada do anterior fica para o novo.
    discardSessionData()
    clearUserPrivateData(previousId)
  }
  // Depois de um 401 não há "anterior" em memória (nem após refresh): quem entra de novo como
  // outro usuário também apaga o que sobrou do anterior. O mesmo usuário mantém tudo.
  clearOtherUsersPrivateData(session.user.id)
  allowPrivateData(session.user.id)
  tokenStorage.set(session.token)
  setState({ status: 'authenticated', user: session.user, token: session.token })
  openSocket(session.token)
  // Login/cadastro mesclam o carrinho de visitante no do usuário: busca de novo.
  void queryClient.invalidateQueries({ queryKey: queryKeys.cartAll })
}

/** Encerra localmente (logout, 401, token inválido). */
const endSession = () => {
  tokenStorage.clear()
  discardSessionData()
  setState({ status: 'anonymous', user: null, token: null })
  // O cache foi limpo; quem observa o carrinho busca o do visitante.
  void queryClient.invalidateQueries({ queryKey: queryKeys.cartAll })
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
    const userId = state.user?.id
    try {
      await authApi.logout()
    } catch {
      // Logout é local mesmo se a API falhar; o token some do cliente.
    } finally {
      // Tentativa de checkout, pedido pendente e rascunho têm dados pessoais: saem junto com a
      // sessão. A expiração (401) não passa por aqui, então eles sobrevivem para a retomada.
      if (userId) clearUserPrivateData(userId)
      endSession()
    }
  },

  /** Sessão recusada pela API durante o uso (401). */
  expire: endSession,
}
