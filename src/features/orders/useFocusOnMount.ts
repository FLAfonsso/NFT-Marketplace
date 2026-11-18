import { useEffect, useRef } from 'react'

/** Foco no título ao abrir a tela. O título precisa de tabIndex={-1}. */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])
  return ref
}
