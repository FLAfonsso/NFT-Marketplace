/** Usuários do seed dos mocks (docs/API.md). Única fonte de e-mail e senha para os testes. */
export const USERS = {
  ana: { email: 'ana@example.com', password: 'ana12345', name: 'Ana Souza' },
  bruno: { email: 'bruno@example.com', password: 'bruno12345', name: 'Bruno Lima' },
} as const

export type UserKey = keyof typeof USERS
