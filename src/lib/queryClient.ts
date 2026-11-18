import { QueryClient } from '@tanstack/react-query'
import { isApiRequestError } from './api'

/**
 * Política de cache e retries:
 * - staleTime de 30 s: navegação entre telas reaproveita o cache sem refetch imediato;
 *   tempo real (Socket.IO) e invalidação após mutations cuidam da frescura no restante.
 * - gcTime de 5 min (padrão) para dados sem observadores.
 * - Retry só para falhas transitórias (rede ou 5xx `transient`), até 2 novas tentativas com
 *   backoff exponencial. 4xx (validação, 401, 403, 404, 409) e respostas fora do contrato
 *   nunca são repetidas.
 * - Mutations não repetem: reenvio automático pode duplicar efeitos (ex.: pedido).
 * - Dados privados usam chaves com o id do usuário (queryKeys.ts) e o cache inteiro é limpo
 *   no logout e na troca de usuário (features/auth).
 */
const MAX_RETRIES = 2

export const shouldRetry = (failureCount: number, error: unknown) =>
  failureCount < MAX_RETRIES && isApiRequestError(error) && error.transient

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: shouldRetry,
      retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4_000),
    },
    mutations: {
      retry: false,
    },
  },
})
