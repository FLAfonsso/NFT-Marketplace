import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Nft } from '@/contracts'
import { useAddToCart } from '@/features/cart'
import { isApiRequestError } from '@/lib/api'
import { queryKeys } from '@/lib/queryKeys'

/**
 * Edição, quantidade e envio ao carrinho do detalhe.
 * Edição e quantidade efetivas são derivadas dos dados atuais: se o estoque mudar em segundo
 * plano (ou a edição esgotar), a escolha se ajusta sem efeitos nem estado duplicado.
 */
export function usePurchase(nft: Nft) {
  const [editionId, setEditionId] = useState<string | null>(null)
  const [requested, setRequested] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const add = useAddToCart()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const edition =
    nft.editions.find((e) => e.id === editionId && e.available > 0) ??
    nft.editions.find((e) => e.available > 0) ??
    null
  const max = edition ? Math.max(1, Math.min(edition.available, edition.maxPerOrder)) : 1
  const quantity = Math.min(requested, max)

  const selectEdition = (id: string) => {
    const next = nft.editions.find((e) => e.id === id)
    if (!next || next.available === 0) return
    setEditionId(id)
    setRequested((q) => Math.min(q, Math.max(1, Math.min(next.available, next.maxPerOrder))))
    setError(null)
  }

  const changeQuantity = (value: number) => {
    setRequested(Math.max(1, Math.min(Math.trunc(value), max)))
    setError(null)
  }

  /** `goToCart`: COMPRAR vai a /cart; o ícone do mobile só adiciona e avisa. */
  const submit = async (goToCart: boolean) => {
    if (!edition || inFlight.current) return
    inFlight.current = true
    setError(null)
    try {
      await add.mutateAsync({ nftId: nft.id, editionId: edition.id, quantity })
      if (goToCart) await navigate({ to: '/cart' })
      else toast.success(`${nft.name} (${edition.name}) adicionado ao carrinho`)
    } catch (e) {
      if (isApiRequestError(e) && e.status === 409) {
        setError(`${e.message} Confira o estoque e tente de novo.`)
        void queryClient.invalidateQueries({ queryKey: queryKeys.nfts.detail(nft.id) })
      } else {
        setError(isApiRequestError(e) ? e.message : 'Não foi possível adicionar ao carrinho.')
      }
    } finally {
      inFlight.current = false
    }
  }

  return {
    edition,
    quantity,
    max,
    soldOut: edition === null,
    submitting: add.isPending,
    error,
    selectEdition,
    changeQuantity,
    buy: () => submit(true),
    addOnly: () => submit(false),
  }
}
