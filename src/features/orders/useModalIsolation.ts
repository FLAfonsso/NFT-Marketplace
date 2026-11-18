import { useEffect, type KeyboardEvent } from 'react'

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Isola a página enquanto o modal está aberto: o resto do app fica inert (sem foco, sem clique e
 * fora da árvore de acessibilidade). O isolamento do Dialog não está atuando neste projeto
 * (verificado também no modal de login), então o recibo garante o foco preso por conta própria.
 */
export function useInertRoot() {
  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return
    root.setAttribute('inert', '')
    return () => root.removeAttribute('inert')
  }, [])
}

/** Tab e Shift+Tab ciclam dentro de `container`. O título (tabIndex -1) conta como o início. */
export function trapTab(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'Tab') return
  const container = event.currentTarget
  const items = Array.from(container.querySelectorAll<HTMLElement>(TABBABLE))
  if (items.length === 0) {
    event.preventDefault()
    return
  }
  const first = items[0]
  const last = items[items.length - 1]
  const active = document.activeElement
  const inList = active instanceof HTMLElement && items.includes(active)

  if (event.shiftKey && (active === first || !inList)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}
