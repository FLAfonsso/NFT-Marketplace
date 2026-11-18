import type { QueryClient } from '@tanstack/react-query'
import {
  isTerminalOrderStatus,
  type Cart,
  type FavoriteList,
  type Nft,
  type NftListResponse,
  type NftUpdatedEvent,
  type Order,
  type OrderUpdatedEvent,
} from '@/contracts'
import { pendingOrderStorage } from '@/features/checkout/storage'
import { settleTerminalOrder } from '@/features/orders/settleOrder'
import { queryKeys } from '@/lib/queryKeys'

/**
 * Aplicação dos eventos aceitos ao cache do TanStack Query, sempre com setQueryData (sem refazer
 * listas inteiras) e conferindo a version de cada cópia: nenhuma cópia regride.
 */

const NFT_LISTS = ['nfts', 'list'] as const

// ---------------------------------------------------------------------------
// NFT
// ---------------------------------------------------------------------------

/** Cópias do NFT em cache: detalhe, listas do catálogo e favoritos do usuário. */
function cachedNftCopies(queryClient: QueryClient, nftId: string, userId: string | null): Nft[] {
  const copies: Nft[] = []
  const detail = queryClient.getQueryData<Nft>(queryKeys.nfts.detail(nftId))
  if (detail) copies.push(detail)
  for (const [, data] of queryClient.getQueriesData<NftListResponse>({ queryKey: NFT_LISTS })) {
    const found = data?.items.find((n) => n.id === nftId)
    if (found) copies.push(found)
  }
  if (userId) {
    const favorite = queryClient
      .getQueryData<FavoriteList>(queryKeys.favorites(userId))
      ?.items.find((n) => n.id === nftId)
    if (favorite) copies.push(favorite)
  }
  return copies
}

/** NFT mais recente em cache (o detalhe ganha no empate) e a version dele. */
export function latestCachedNft(queryClient: QueryClient, nftId: string, userId: string | null) {
  let latest: Nft | undefined
  for (const copy of cachedNftCopies(queryClient, nftId, userId)) {
    if (!latest || copy.version > latest.version) latest = copy
  }
  return latest
}

/** Estado completo de preço e disponibilidade do evento sobre uma cópia, se ela for mais antiga. */
export function patchNft(nft: Nft, event: NftUpdatedEvent): Nft {
  if (nft.id !== event.resource.id || nft.version >= event.version) return nft
  const available = new Map(event.payload.editions.map((e) => [e.id, e.available]))
  return {
    ...nft,
    price: event.payload.price,
    editions: nft.editions.map((edition) => {
      const next = available.get(edition.id)
      return next === undefined ? edition : { ...edition, available: next }
    }),
    version: event.version,
  }
}

const patchItems = <T extends { items: Nft[] }>(data: T | undefined, event: NftUpdatedEvent) => {
  if (!data || !data.items.some((n) => n.id === event.resource.id)) return data
  return { ...data, items: data.items.map((n) => patchNft(n, event)) }
}

/**
 * nft.updated: detalhe, listas do catálogo (inclui relacionados e sugestões) e favoritos. O
 * carrinho guarda só ids e quantidades e lê o NFT do detalhe, então já vê a mudança; a cotação
 * (que tem os valores) é invalidada nos carrinhos em cache que têm o NFT.
 */
export function applyNftUpdate(queryClient: QueryClient, event: NftUpdatedEvent, userId: string | null) {
  const nftId = event.resource.id

  queryClient.setQueryData<Nft>(queryKeys.nfts.detail(nftId), (nft) => nft && patchNft(nft, event))
  queryClient.setQueriesData<NftListResponse>({ queryKey: NFT_LISTS }, (data) => patchItems(data, event))
  if (userId) {
    queryClient.setQueryData<FavoriteList>(queryKeys.favorites(userId), (data) => patchItems(data, event))
  }

  for (const [key, cart] of queryClient.getQueriesData<Cart>({ queryKey: queryKeys.cartAll })) {
    // ['cart', owner] é o carrinho; ['cart', owner, 'quote', ...] são as cotações dele.
    if (key.length !== 2 || !cart?.items.some((i) => i.nftId === nftId)) continue
    void queryClient.invalidateQueries({ queryKey: [...key, 'quote'] })
  }
}

// ---------------------------------------------------------------------------
// Pedido
// ---------------------------------------------------------------------------

export const cachedOrder = (queryClient: QueryClient, userId: string, orderId: string) =>
  queryClient.getQueryData<Order>(queryKeys.orders.detail(userId, orderId))

/**
 * order.updated: atualiza o pedido em cache (chave por usuário e id) com a version do evento.
 * Terminal nunca volta a pendente. Sem tela observando o pedido, os efeitos do estado terminal
 * (carrinho, catálogo, pendente guardado) rodam aqui; com tela, useOrderStatus cuida deles.
 */
export function applyOrderUpdate(queryClient: QueryClient, event: OrderUpdatedEvent, userId: string) {
  const orderId = event.resource.id
  const key = queryKeys.orders.detail(userId, orderId)
  const previous = queryClient.getQueryData<Order>(key)
  const terminal = isTerminalOrderStatus(event.payload.status)

  if (previous) {
    if (previous.version >= event.version) return
    if (isTerminalOrderStatus(previous.status)) return
    queryClient.setQueryData<Order>(key, {
      ...previous,
      status: event.payload.status,
      transactionRef: event.payload.transactionRef,
      rejectionReason: event.payload.rejectionReason,
      updatedAt: event.occurredAt,
      version: event.version,
    })
  }

  void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all(userId), refetchType: 'none' })
  if (!terminal) return

  const observed = (queryClient.getQueryCache().find({ queryKey: key, exact: true })?.getObserversCount() ?? 0) > 0
  if (observed) return
  const updated = queryClient.getQueryData<Order>(key)
  if (updated && isTerminalOrderStatus(updated.status)) {
    settleTerminalOrder(queryClient, userId, updated)
  } else {
    if (pendingOrderStorage.load(userId) === orderId) pendingOrderStorage.clear(userId)
    void queryClient.invalidateQueries({ queryKey: queryKeys.cart({ userId }) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.nfts.all })
  }
}

// ---------------------------------------------------------------------------
// Reconexão
// ---------------------------------------------------------------------------

/**
 * Depois de uma queda, eventos podem ter se perdido: relê pela API o que está na tela (NFTs em
 * lista e detalhe, carrinho e cotação, pedidos do usuário). Só as queries ativas são refeitas;
 * as demais ficam velhas e relêem quando voltarem à tela.
 */
export function reconcileWithApi(queryClient: QueryClient, userId: string | null) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.nfts.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.cartAll })
  if (userId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all(userId) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.favorites(userId) })
  }
}
