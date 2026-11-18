import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { isApiRequestError } from '@/lib/api'

export interface FormAlert {
  message: string
  /** Falha de rede ou 5xx: vale oferecer "Tentar de novo". */
  retryable: boolean
}

/**
 * Leva o erro da API para onde ele pertence: campo (fieldErrors, 409 de e-mail) ou aviso do
 * formulário (credenciais, rede, 5xx). Devolve o aviso, ou null se tudo foi para os campos.
 */
export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
  conflictField?: Path<T>,
): FormAlert | null {
  if (!isApiRequestError(error)) {
    return { message: 'Não foi possível concluir. Tente novamente.', retryable: true }
  }

  let placed = false
  for (const [key, messages] of Object.entries(error.fieldErrors ?? {})) {
    const field = fields.find((name) => name === key)
    if (field && messages[0]) {
      setError(field, { type: 'server', message: messages[0] })
      placed = true
    }
  }
  if (placed) return null

  if (error.code === 'conflict' && conflictField) {
    setError(conflictField, { type: 'server', message: error.message })
    return null
  }

  return { message: error.message, retryable: error.transient }
}
