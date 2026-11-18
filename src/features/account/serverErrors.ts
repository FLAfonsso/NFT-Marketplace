import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { isApiRequestError } from '@/lib/api'

export interface FormAlertState {
  message: string
  /** Falha de rede ou 5xx: vale oferecer "Tentar de novo". */
  retryable: boolean
}

/**
 * Leva o erro da API (400/409/422 com fieldErrors) para o campo certo. `fieldMap` traduz o
 * caminho da API para o nome do campo do formulário (ex.: ensName → ensLabel). Quando nada casa
 * com um campo, devolve um aviso para o topo do formulário.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fieldMap: Record<string, Path<T>>,
): FormAlertState | null {
  if (!isApiRequestError(error)) {
    return { message: 'Não foi possível concluir. Tente novamente.', retryable: true }
  }
  let first = true
  for (const [key, messages] of Object.entries(error.fieldErrors ?? {})) {
    const field = fieldMap[key]
    if (field && messages[0]) {
      setError(field, { type: 'server', message: messages[0] }, { shouldFocus: first })
      first = false
    }
  }
  if (!first) return null
  return { message: error.message, retryable: error.transient }
}
