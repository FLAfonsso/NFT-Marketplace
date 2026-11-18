import { useAuth } from '@/features/auth'

/** Id do usuário logado, ou null enquanto a sessão encerra. Todas as chaves de cache privado levam este id. */
export function useUserId(): string | null {
  const auth = useAuth()
  return auth.status === 'authenticated' ? auth.user.id : null
}
