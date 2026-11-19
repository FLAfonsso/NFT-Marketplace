import { useEffect } from 'react'

export const APP_NAME = 'Kurio'

/** Título do documento (aba, histórico, leitores de tela). Sem título, não mexe no atual. */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (title) document.title = title
  }, [title])
}
