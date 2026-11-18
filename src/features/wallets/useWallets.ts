import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Wallet, WalletList, type WalletInput } from '@/contracts'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/queryKeys'

export const walletsApi = {
  list: (signal?: AbortSignal) => api.get(WalletList, '/wallets', { signal }),
  create: (input: WalletInput) => api.post(Wallet, '/wallets', input),
  update: (id: string, input: WalletInput) =>
    api.patch(Wallet, `/wallets/${encodeURIComponent(id)}`, input),
}

/** Carteiras do usuário. A mesma chave abastece o Pagamento: salvar aqui atualiza lá. */
export function useWallets(userId: string) {
  return useQuery({
    queryKey: queryKeys.wallets(userId),
    queryFn: ({ signal }) => walletsApi.list(signal),
  })
}

/** Cadastra (sem id) ou edita uma carteira e invalida carteiras e perfil (apelido da principal). */
export function useSaveWallet(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: WalletInput }) =>
      id ? walletsApi.update(id, input) : walletsApi.create(input),
    onSuccess: (wallet) => {
      queryClient.setQueryData<WalletList>(queryKeys.wallets(userId), (old) => {
        const items = old?.items ?? []
        return {
          items: items.some((w) => w.id === wallet.id)
            ? items.map((w) => (w.id === wallet.id ? wallet : w))
            : [...items, wallet],
        }
      })
    },
    // Promover uma carteira rebaixa a outra, e o apelido da principal vive no perfil.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.wallets(userId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) }),
      ]),
  })
}
