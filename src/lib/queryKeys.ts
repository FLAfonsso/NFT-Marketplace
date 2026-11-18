import type { NftListQuery } from '@/contracts'

/**
 * Fábrica de query keys.
 * - Dados públicos (catálogo) não dependem do usuário.
 * - Dados privados começam com ['user', userId], o que isola o cache por usuário e permite
 *   invalidar tudo de um usuário com queryKeys.user(userId).
 * - Carrinho pertence ao usuário ou ao visitante (id gerado no cliente).
 */
export type CartOwner = { userId: string } | { guestId: string }

export const queryKeys = {
  nfts: {
    all: ['nfts'] as const,
    list: (query: NftListQuery) => ['nfts', 'list', query] as const,
    detail: (id: string) => ['nfts', 'detail', id] as const,
  },

  /** Todos os carrinhos (de qualquer dono): usado para invalidar após login e logout. */
  cartAll: ['cart'] as const,
  cart: (owner: CartOwner) => ['cart', owner] as const,
  /** Cotação do carrinho: por dono, itens e cupom. */
  cartQuote: (owner: CartOwner, request: { items: readonly unknown[]; couponCode?: string }) =>
    ['cart', owner, 'quote', request] as const,

  user: (userId: string) => ['user', userId] as const,
  profile: (userId: string) => ['user', userId, 'profile'] as const,
  favorites: (userId: string) => ['user', userId, 'favorites'] as const,
  wallets: (userId: string) => ['user', userId, 'wallets'] as const,
  orders: {
    all: (userId: string) => ['user', userId, 'orders'] as const,
    detail: (userId: string, orderId: string) => ['user', userId, 'orders', orderId] as const,
  },
}
