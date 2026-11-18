/** Token opaco da sessão em localStorage. Tolerante a storage indisponível. */
export const TOKEN_STORAGE_KEY = 'nft-marketplace:session-token'

export const tokenStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY)
    } catch {
      return null
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token)
    } catch {
      // Sem storage a sessão vale só até o refresh.
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
    } catch {
      // Idem.
    }
  },
}
