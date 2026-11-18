import { useCallback, useEffect, useRef, type RefObject } from 'react'

/**
 * Devolve o foco depois de remover um item: vai para a lixeira do próximo item (ou do anterior,
 * se era o último) e, sem itens, para `fallback` (ex.: o título do carrinho vazio).
 * `prepare(key)` é chamado ao pedir a remoção; `cancel()` se a API recusar.
 * Cada lixeira precisa ter `data-remove-key="<chave do item>"`.
 */
export function useFocusAfterRemove(
  keys: readonly string[],
  container: RefObject<HTMLElement | null>,
  fallback: RefObject<HTMLElement | null>,
) {
  const pending = useRef<{ removed: string; next: string | null } | null>(null)
  const signature = keys.join('|')

  // Mantém a lista atual acessível ao `prepare` sem recriá-lo a cada render.
  const current = useRef(keys)
  useEffect(() => {
    current.current = keys
  })

  const prepare = useCallback((removed: string) => {
    const list = current.current
    const index = list.indexOf(removed)
    pending.current = { removed, next: list[index + 1] ?? list[index - 1] ?? null }
  }, [])

  const cancel = useCallback(() => {
    pending.current = null
  }, [])

  useEffect(() => {
    const request = pending.current
    if (!request || signature.split('|').includes(request.removed)) return
    pending.current = null
    const target = request.next
      ? container.current?.querySelector<HTMLElement>(
          `[data-remove-key="${CSS.escape(request.next)}"]`,
        )
      : null
    ;(target ?? fallback.current)?.focus()
  }, [signature, container, fallback])

  return { prepare, cancel }
}
