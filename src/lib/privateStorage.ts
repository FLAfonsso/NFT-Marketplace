/**
 * Dados privados do usuário no navegador (localStorage e sessionStorage).
 *
 * Regra: toda chave com dado pessoal termina com o id do usuário (`<escopo><userId>`) e o escopo
 * é declarado aqui, em um lugar só. Quem grava usa `userKey`; quem limpa usa as funções abaixo.
 * Chaves sem dado pessoal (token da sessão, id do carrinho de visitante, estado das simulações)
 * não passam por este módulo.
 */

export const APP_STORAGE_PREFIX = 'nft-marketplace:'

/** Escopos por usuário. A chave completa é `escopo + userId`. */
const SCOPES = {
  checkoutDraft: `${APP_STORAGE_PREFIX}checkout:draft:`,
  checkoutAttempt: `${APP_STORAGE_PREFIX}checkout:attempt:`,
  checkoutPendingOrder: `${APP_STORAGE_PREFIX}checkout:pending-order:`,
} as const

export type UserScope = keyof typeof SCOPES

export const userKey = (scope: UserScope, userId: string) => `${SCOPES[scope]}${userId}`

/**
 * Usuários cujos dados foram apagados (logout ou troca): enquanto não entrarem de novo, um
 * efeito ainda montado (formulário, reenvio em andamento) não pode regravar o que foi apagado.
 */
const erased = new Set<string>()

export const canWritePrivateData = (userId: string) => !erased.has(userId)

/** O usuário autenticou: volta a poder gravar. */
export function allowPrivateData(userId: string) {
  erased.delete(userId)
}

function storages(): Storage[] {
  const list: Storage[] = []
  for (const get of [() => localStorage, () => sessionStorage]) {
    try {
      list.push(get())
    } catch {
      // Storage indisponível: não há o que limpar.
    }
  }
  return list
}

const keysOf = (storage: Storage) =>
  Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(
    (key): key is string => key !== null,
  )

function removeWhere(matches: (key: string) => boolean) {
  for (const storage of storages()) {
    try {
      for (const key of keysOf(storage)) if (matches(key)) storage.removeItem(key)
    } catch {
      // Idem.
    }
  }
}

/** Apaga tudo do app que pertence ao usuário: qualquer chave `nft-marketplace:…:<userId>`. */
export function clearUserPrivateData(userId: string) {
  erased.add(userId)
  removeWhere((key) => key.startsWith(APP_STORAGE_PREFIX) && key.split(':').includes(userId))
}

/** Apaga os dados de todo usuário diferente de `userId` (troca de usuário, inclusive após 401). */
export function clearOtherUsersPrivateData(userId: string) {
  const owners = new Set<string>()
  removeWhere((key) => {
    for (const scope of Object.values(SCOPES)) {
      if (!key.startsWith(scope)) continue
      const owner = key.slice(scope.length)
      if (owner === userId) return false
      owners.add(owner)
      return true
    }
    return false
  })
  owners.forEach((owner) => erased.add(owner))
}
