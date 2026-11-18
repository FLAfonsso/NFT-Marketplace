import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { checkoutApi } from './checkoutApi'

/** Perfil e carteiras cadastradas do usuário (pré-preenchimento e seleção de carteira). */
export function useCheckoutData(userId: string) {
  const profile = useQuery({
    queryKey: queryKeys.profile(userId),
    queryFn: ({ signal }) => checkoutApi.profile(signal),
  })
  const wallets = useQuery({
    queryKey: queryKeys.wallets(userId),
    queryFn: ({ signal }) => checkoutApi.wallets(signal),
  })
  return { profile, wallets }
}
