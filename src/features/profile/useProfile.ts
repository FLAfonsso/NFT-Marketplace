import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Profile, UpdateProfileInput } from '@/contracts'
import { sessionStore } from '@/features/auth'
import { blobToDataUrl } from '@/lib/image'
import { queryKeys } from '@/lib/queryKeys'
import { profileApi } from './profileApi'

/** Perfil do usuário logado. A chave leva o id do usuário: nada de uma conta aparece na outra. */
export function useProfile(userId: string) {
  return useQuery({
    queryKey: queryKeys.profile(userId),
    queryFn: ({ signal }) => profileApi.get(signal),
  })
}

/**
 * Reflete um Profile salvo no cache e na sessão (o nome do header muda na hora), e invalida o
 * que depende dele: a sessão e as carteiras (o apelido é o da carteira principal).
 */
function useApplyProfile(userId: string) {
  const queryClient = useQueryClient()
  return (profile: Profile) => {
    queryClient.setQueryData(queryKeys.profile(userId), profile)
    sessionStore.updateUser({
      name: profile.displayName,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
    })
    void queryClient.invalidateQueries({ queryKey: queryKeys.wallets(userId) })
    void sessionStore.refresh()
  }
}

export function useUpdateProfile(userId: string) {
  const apply = useApplyProfile(userId)
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => profileApi.update(input),
    onSuccess: (profile) => apply(profile),
  })
}

type AvatarChange = { remove: true } | { blob: Blob }

/** Avatar com atualização otimista: a prévia aparece já; em falha volta ao que estava. */
export function useAvatarMutation(userId: string) {
  const queryClient = useQueryClient()
  const key = queryKeys.profile(userId)

  const show = (avatarUrl: string | null) => {
    queryClient.setQueryData<Profile>(key, (old) => (old ? { ...old, avatarUrl } : old))
    sessionStore.updateUser({ avatarUrl })
  }

  return useMutation({
    mutationFn: (change: AvatarChange) =>
      'blob' in change ? profileApi.uploadAvatar(change.blob) : profileApi.removeAvatar(),
    onMutate: async (change) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Profile>(key)?.avatarUrl ?? null
      show('blob' in change ? await blobToDataUrl(change.blob) : null)
      return { previous }
    },
    onError: (_error, _change, context) => {
      // Só o avatar volta: o resto do perfil pode ter sido salvo enquanto isso.
      if (context) show(context.previous)
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(key, profile)
      sessionStore.updateUser({ avatarUrl: profile.avatarUrl })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
