import { useQueries } from '@tanstack/react-query'
import type { CartItem, Nft, NftEdition } from '@/contracts'
import { nftApi } from '@/features/catalog/nftApi'
import { queryKeys } from '@/lib/queryKeys'

export const itemKey = (item: { nftId: string; editionId: string }) =>
  `${item.nftId}:${item.editionId}`

export interface CartLine {
  item: CartItem
  key: string
  nft: Nft | undefined
  edition: NftEdition | undefined
  /** Falha ao carregar os dados do NFT (a linha mostra "Tentar de novo"). */
  failed: boolean
  retry: () => void
}

/**
 * Junta cada item do carrinho (só ids e quantidade) com o NFT da API. Usa a mesma chave do
 * detalhe, então o cache é compartilhado com a tela do NFT.
 */
export function useCartLines(items: readonly CartItem[]): CartLine[] {
  const results = useQueries({
    queries: items.map((item) => ({
      queryKey: queryKeys.nfts.detail(item.nftId),
      queryFn: ({ signal }: { signal: AbortSignal }) => nftApi.get(item.nftId, signal),
    })),
  })

  return items.map((item, index) => {
    const result = results[index]
    const nft = result?.data
    return {
      item,
      key: itemKey(item),
      nft,
      edition: nft?.editions.find((e) => e.id === item.editionId),
      failed: !nft && !!result?.isError,
      retry: () => void result?.refetch(),
    }
  })
}
