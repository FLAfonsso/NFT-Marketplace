import { useEffect } from 'react'

/** Quantos modais estão abertos: o fundo só volta a ser lido quando o último fecha. */
let openModals = 0

/**
 * Renderize dentro do conteúdo de um modal (Dialog, Sheet). Enquanto ele existe, o app atrás
 * (#root) fica fora da árvore de acessibilidade com aria-hidden. O isolamento do Dialog da
 * biblioteca marca o fundo só com um atributo interno (data-base-ui-inert), que não esconde
 * nada de leitores de tela. aria-hidden, e não inert, para o foco poder voltar ao elemento que
 * abriu o modal no instante em que ele fecha.
 */
export function HideBackground() {
  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return
    openModals += 1
    root.setAttribute('aria-hidden', 'true')
    return () => {
      openModals -= 1
      if (openModals === 0) root.removeAttribute('aria-hidden')
    }
  }, [])
  return null
}
