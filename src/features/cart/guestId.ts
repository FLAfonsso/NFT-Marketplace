const KEY = 'nft-marketplace:guest-cart-id'
let memory: string | null = null

/** Id do carrinho de visitante, gerado no cliente (X-Guest-Cart-Id). Tolera storage indisponível. */
export function getGuestId(): string {
  if (memory) return memory
  try {
    memory = localStorage.getItem(KEY)
  } catch {
    memory = null
  }
  if (!memory) {
    memory = crypto.randomUUID()
    try {
      localStorage.setItem(KEY, memory)
    } catch {
      // Sem storage o id vale até o refresh.
    }
  }
  return memory
}
