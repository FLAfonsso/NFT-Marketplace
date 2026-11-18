import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { FavoriteList, Nft } from '@/contracts'
import { useAuth } from '@/features/auth'
import { queryKeys } from '@/lib/queryKeys'
import { favoritesApi } from './favoritesApi'

type ToggleVars = { nft: Nft; favorite: boolean }

const TOGGLE_KEY = ['favorites', 'toggle'] as const

/** Aplica ou desfaz um favorito na lista em cache (o mais recente vai para o início). */
const withFavorite = (current: FavoriteList | undefined, nft: Nft, favorite: boolean): FavoriteList => {
  const rest = (current?.items ?? []).filter((item) => item.id !== nft.id)
  return { items: favorite ? [nft, ...rest] : rest }
}

/**
 * Favoritos do usuário logado, com atualização otimista e rollback em falha.
 * Visitante: `toggle` leva a /login?redirect=<rota atual>.
 *
 * O coração só fica ocupado durante a mutation do próprio NFT (`isBusy`), para evitar duplo envio;
 * nunca por causa da consulta da lista ou da mutation de outro NFT.
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

  // NFTs com mutation em andamento (de qualquer componente que use este hook).
  const pendingIds = useMutationState({
    filters: { mutationKey: TOGGLE_KEY, status: 'pending' },
    select: (mutation) => (mutation.state.variables as ToggleVars).nft.id,
  })

  const mutation = useMutation({
    mutationKey: TOGGLE_KEY,
    mutationFn: ({ nft, favorite }: ToggleVars) =>
      favorite ? favoritesApi.add(nft.id) : favoritesApi.remove(nft.id),
    onMutate: async ({ nft, favorite }) => {
      const key = queryKeys.favorites(userId ?? '')
      await queryClient.cancelQueries({ queryKey: key })
      queryClient.setQueryData<FavoriteList>(key, (current) => withFavorite(current, nft, favorite))
      return { key }
    },
    onError: (_error, { nft, favorite }, context) => {
      // Rollback só deste NFT: outras mutations em andamento não são desfeitas.
      if (context) {
        queryClient.setQueryData<FavoriteList>(context.key, (current) =>
          current ? withFavorite(current, nft, !favorite) : current,
        )
      }
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

  const items = query.data?.items
  const isFavorite = (nftId: string) => !!items?.some((item) => item.id === nftId)
  const isBusy = (nftId: string) => pendingIds.includes(nftId)

  const toggle = (nft: Nft) => {
    if (userId === null) {
      // Já indo para (ou estando em) /login: a sessão acabou de expirar; não sobrescreve o redirect.
      if (/^\/(login|signup)(\?|#|$)/.test(href)) return
      void navigate({ to: '/login', search: { redirect: href } })
      return
    }
    if (isBusy(nft.id)) return
    mutation.mutate({ nft, favorite: !isFavorite(nft.id) })
  }

  return { isFavorite, isBusy, toggle, query }
}
