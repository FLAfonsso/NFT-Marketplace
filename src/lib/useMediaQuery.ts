import { useSyncExternalStore } from 'react'

/** Segue uma media query. Lê o valor na primeira renderização, sem piscar o layout errado. */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', notify)
      return () => list.removeEventListener('change', notify)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Breakpoint desktop de docs/design/screens.md (mobile < 768). */
export const useIsDesktop = () => useMediaQuery('(min-width: 768px)')
