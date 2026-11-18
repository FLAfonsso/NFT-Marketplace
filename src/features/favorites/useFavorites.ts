import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { FavoriteList, Nft } from '@/contracts'
import { useAuth } from '@/features/auth'
import { queryKeys } from '@/lib/queryKeys'
import { favoritesApi } from './favoritesApi'

type ToggleVars = { nft: Nft; favorite: boolean }

/**
 * Favoritos do usuário logado, com atualização otimista e rollback em falha.
 * Visitante: `toggle` leva a /login?redirect=<rota atual>.
 */
export function useFavorites() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })
  const userId = auth.status === 'authenticated' ? auth.user.id : null

  const query = useQuery({
    queryKey: queryKeys.favorites(userId ?? ''),
    queryFn: ({ signal }) => favoritesApi.list(signal),
    enabled: userId !== null,
  })

  const mutation = useMutation({
    mutationFn: ({ nft, favorite }: ToggleVars) =>
      favorite ? favoritesApi.add(nft.id) : favoritesApi.remove(nft.id),
    onMutate: async ({ nft, favorite }) => {
      const key = queryKeys.favorites(userId ?? '')
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<FavoriteList>(key)
      queryClient.setQueryData<FavoriteList>(key, (current) => {
        const rest = (current?.items ?? []).filter((item) => item.id !== nft.id)
        return { items: favorite ? [nft, ...rest] : rest }
      })
      return { previous, key }
    },
    onError: (_error, { favorite }, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous)
      toast.error(
        favorite
          ? 'Não foi possível favoritar. Tente de novo.'
          : 'Não foi possível remover dos favoritos. Tente de novo.',
      )
    },
    onSettled: (_data, _error, _vars, context) => {
      if (context) void queryClient.invalidateQueries({ queryKey: context.key })
    },
  })

  const isFavorite = (nftId: string) => !!query.data?.items.some((item) => item.id === nftId)

  const toggle = (nft: Nft) => {
    if (userId === null) {
      void navigate({ to: '/login', search: { redirect: href } })
      return
    }
    if (mutation.isPending) return
    mutation.mutate({ nft, favorite: !isFavorite(nft.id) })
  }

  return {
    isFavorite,
    toggle,
    /** Logado e ainda sem a lista, ou salvando: o botão fica desabilitado. */
    busy: (userId !== null && query.isPending) || mutation.isPending,
  }
}
