import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { ApiError, CartItem, CreateOrderInput, Order, Quote, QuoteRequest } from '@/contracts'
import { cartApi } from '@/features/cart'
import { isApiRequestError } from '@/lib/api'
import { checkoutApi, isKeyConflict, orderConflictOf } from './checkoutApi'
import { contentHash, prepareAttempt } from './idempotency'
import {
  checkoutReducer,
  initialCheckoutState,
  type CheckoutError,
  type ReviewSnapshot,
} from './machine'
import { settleOrderLocally } from './pendingOrder'
import { diffQuotes, isBlockingQuote, type QuoteChange } from './quoteChanges'
import { attemptStorage, pendingOrderStorage } from './storage'

/** Reenvios com a mesma chave depois de timeout ou queda, antes de pedir ação ao usuário. */
const MAX_RECOVERY_ATTEMPTS = 5
const backoffMs = (attempt: number) => Math.min(1_000 * 2 ** (attempt - 1), 8_000)

type Outcome =
  | { type: 'order'; order: Order }
  /** Sem resposta (timeout, queda): o pedido pode ter sido criado. */
  | { type: 'network' }
  | { type: 'error'; error: unknown }

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      resolve()
    })
  })

const quoteRequestOf = (order: {
  items: readonly CartItem[]
  couponCode?: string | null
}): QuoteRequest => ({
  items: order.items.map(({ nftId, editionId, quantity }) => ({ nftId, editionId, quantity })),
  ...(order.couponCode ? { couponCode: order.couponCode } : {}),
})

const fail = (kind: CheckoutError['kind'], message: string): CheckoutError => ({ kind, message })

export interface CheckoutFlowOptions {
  userId: string
  /** Nome do item para os textos de mudança ("Violet Nomad #314: preço unitário"). */
  nameOf: (line: { nftId: string; editionId: string }) => string
  /** Erros de campo do 400 da API. Devolve true se algum foi para um campo do formulário. */
  onFieldErrors: (fieldErrors: NonNullable<ApiError['fieldErrors']>) => boolean
}

/**
 * Revisão, revalidação e envio do pedido (máquina em machine.ts).
 *
 * - Um único envio por vez: ref de guarda (clique repetido no mesmo frame) além do botão
 *   desabilitado pelo estado.
 * - O POST /orders é uma mutation sem retry do Query. Timeout ou queda não geram chave nova:
 *   o mesmo corpo é reenviado com a mesma Idempotency-Key, com backoff, até a API devolver o
 *   pedido (201 ou 200 de repetição) ou uma resposta definitiva.
 * - Ao abrir a tela com um envio sem resposta guardado, a verificação recomeça sozinha.
 */
export function useCheckoutFlow({ userId, nameOf, onFieldErrors }: CheckoutFlowOptions) {
  const [state, dispatch] = useReducer(checkoutReducer, initialCheckoutState)
  const navigate = useNavigate()
  const inFlight = useRef(false)
  const lifetime = useRef<AbortController | null>(null)
  const callbacks = useRef({ nameOf, onFieldErrors })

  useEffect(() => {
    callbacks.current = { nameOf, onFieldErrors }
  })

  const createOrder = useMutation({ mutationFn: checkoutApi.createOrder, retry: false })
  const { mutateAsync } = createOrder

  const signal = () => lifetime.current?.signal ?? AbortSignal.abort()

  const finishWithOrder = useCallback(
    (order: Order) => {
      dispatch({ type: 'ORDER', order })
      if (order.status === 'pending') {
        pendingOrderStorage.save(userId, order.id)
        attemptStorage.update(userId, { uncertain: false })
      } else {
        settleOrderLocally(userId, order)
      }
      // Rejeitado fica no checkout (carrinho e formulário intactos) com o motivo.
      if (order.status !== 'rejected') {
        void navigate({ to: '/orders/$id', params: { id: order.id } })
      }
    },
    [navigate, userId],
  )

  const attemptOnce = useCallback(
    async (input: CreateOrderInput): Promise<Outcome> => {
      try {
        return { type: 'order', order: await mutateAsync(input) }
      } catch (error) {
        if (isApiRequestError(error) && error.kind === 'network') return { type: 'network' }
        return { type: 'error', error }
      }
    },
    [mutateAsync],
  )

  /** Envia e, sem resposta, reenvia o mesmo corpo (mesma chave) com backoff. */
  const sendWithRecovery = useCallback(
    async (input: CreateOrderInput): Promise<Outcome> => {
      let outcome = await attemptOnce(input)
      for (let attempt = 1; outcome.type === 'network' && attempt <= MAX_RECOVERY_ATTEMPTS; attempt++) {
        if (signal().aborted) break
        dispatch({ type: 'RECOVERING', attempt })
        await wait(backoffMs(attempt), signal())
        if (signal().aborted) break
        outcome = await attemptOnce(input)
      }
      return outcome
    },
    [attemptOnce],
  )

  const quoteChanged = useCallback(
    (review: ReviewSnapshot | null, quote: Quote, reason: string, extra: QuoteChange[] = []) => {
      const diff = review ? diffQuotes(review.quote, quote, callbacks.current.nameOf) : []
      const changes = [...diff, ...extra.filter((c) => !diff.some((d) => d.id === c.id))]
      dispatch({
        type: 'QUOTE_CHANGED',
        quote,
        changes:
          changes.length > 0
            ? changes
            : [{ id: 'quote', label: 'Cotação', before: 'Vencida', after: 'Renovada, mesmos valores' }],
        blocking: isBlockingQuote(quote),
        reason,
      })
    },
    [],
  )

  /** Resposta definitiva de erro do POST /orders. Nada aqui mexe no carrinho ou no formulário. */
  const handleError = useCallback(
    async (error: unknown, review: ReviewSnapshot | null, input: CreateOrderInput) => {
      if (!isApiRequestError(error)) {
        dispatch({ type: 'FAIL', error: fail('other', 'Não foi possível enviar o pedido.') })
        return
      }
      // A API respondeu: com esta chave e este corpo, nenhum pedido ficou para trás.
      attemptStorage.update(userId, { uncertain: false })

      if (error.code === 'unauthorized') return // O interceptor leva ao login; o rascunho fica.

      if (isKeyConflict(error)) {
        attemptStorage.update(userId, { conflict: true })
        // A chave já criou um pedido: se for deste usuário, é o pedido a recuperar.
        const existing = await checkoutApi
          .orders()
          .then((list) => list.items.find((o) => o.idempotencyKey === input.idempotencyKey))
          .catch(() => undefined)
        if (existing) return finishWithOrder(existing)
        dispatch({
          type: 'FAIL',
          error: fail(
            'key_conflict',
            'Esta tentativa de pedido já foi usada com outros dados. Revise e confirme de novo para enviar um novo pedido.',
          ),
        })
        return
      }

      const conflict = orderConflictOf(error)
      if (conflict?.reason === 'price_changed') {
        quoteChanged(review, conflict.quote, conflict.message)
        return
      }

      const staleQuote =
        conflict !== null ||
        (error.code === 'conflict' && !isKeyConflict(error)) ||
        (error.code === 'not_found' && !error.fieldErrors)
      if (staleQuote) {
        // Esgotou, cotação vencida ou divergente: busca a cotação atual para mostrar a mudança.
        try {
          const quote = await cartApi.quote(null, quoteRequestOf(review ?? input))
          const stock: QuoteChange[] =
            conflict
              ? [
                  {
                    id: `${conflict.nftId}:${conflict.editionId}:stock`,
                    label: `${callbacks.current.nameOf(conflict)}: disponibilidade`,
                    before: 'Disponível',
                    after: conflict.available === 0 ? 'Esgotado' : `Restam ${conflict.available}`,
                  },
                ]
              : []
          quoteChanged(review, quote, conflict?.message ?? error.message, stock)
        } catch {
          dispatch({ type: 'FAIL', error: fail('revalidation', error.message) })
        }
        return
      }

      if (error.code === 'validation' && error.fieldErrors) {
        const placed = callbacks.current.onFieldErrors(error.fieldErrors)
        dispatch({
          type: 'FAIL',
          error: placed
            ? fail('validation', 'Revise os campos destacados no formulário.')
            : fail('other', error.message),
        })
        return
      }

      dispatch({
        type: 'FAIL',
        error: error.transient
          ? fail('transient', 'O serviço está instável e o pedido não foi concluído.')
          : fail('other', error.message),
      })
    },
    [finishWithOrder, quoteChanged, userId],
  )

  const handleOutcome = useCallback(
    async (outcome: Outcome, review: ReviewSnapshot | null, input: CreateOrderInput) => {
      // A API respondeu com erro: nenhum pedido ficou para trás com esta chave. Registra antes
      // de checar a saída da tela (o 401 desmonta o checkout), para a volta do login não
      // reenviar sozinha: o usuário confirma de novo e a mesma chave é reaproveitada.
      if (outcome.type === 'error' && isApiRequestError(outcome.error) && outcome.error.kind === 'http') {
        attemptStorage.update(userId, { uncertain: false })
      }
      if (signal().aborted) return
      if (outcome.type === 'order') return finishWithOrder(outcome.order)
      if (outcome.type === 'network') {
        dispatch({
          type: 'FAIL',
          error: fail(
            'unverified',
            'Ainda não conseguimos confirmar o envio do seu pedido. Ele não será duplicado: a verificação usa a mesma tentativa.',
          ),
        })
        return
      }
      await handleError(outcome.error, review, input)
    },
    [finishWithOrder, handleError, userId],
  )

  /** Envia a revisão confirmada (a cotação dela acabou de ser conferida ou aceita). */
  const submit = useCallback(
    async (review: ReviewSnapshot) => {
      dispatch({ type: 'SUBMIT', review })
      // Um envio anterior, com outro conteúdo, ficou sem resposta: resolve antes de gerar chave.
      const previous = attemptStorage.load(userId)
      if (previous?.uncertain && previous.hash !== contentHash(review)) {
        const outcome = await sendWithRecovery(previous.input)
        if (outcome.type !== 'error') return handleOutcome(outcome, null, previous.input)
        attemptStorage.update(userId, { uncertain: false })
      }
      const attempt = prepareAttempt(userId, review)
      const outcome = await sendWithRecovery(attempt.input)
      await handleOutcome(outcome, review, attempt.input)
    },
    [handleOutcome, sendWithRecovery, userId],
  )

  const revalidateAndSubmit = useCallback(
    async (review: ReviewSnapshot) => {
      let quote: Quote
      try {
        quote = await cartApi.quote(null, quoteRequestOf(review))
      } catch (error) {
        if (isApiRequestError(error) && error.code === 'unauthorized') return
        dispatch({
          type: 'FAIL',
          error: fail('revalidation', 'Não foi possível conferir os valores antes do envio.'),
        })
        return
      }
      if (signal().aborted) return
      const changes = diffQuotes(review.quote, quote, callbacks.current.nameOf)
      if (changes.length > 0 || isBlockingQuote(quote)) {
        quoteChanged(review, quote, 'Os valores mudaram desde a revisão.')
        return
      }
      await submit({ ...review, quote })
    },
    [quoteChanged, submit],
  )

  /** Roda uma etapa com a guarda contra clique repetido. */
  const guarded = useCallback(async (run: () => Promise<void>) => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      await run()
    } finally {
      inFlight.current = false
    }
  }, [])

  const openReview = useCallback((snapshot: ReviewSnapshot) => {
    if (!inFlight.current) dispatch({ type: 'REVIEW', review: snapshot })
  }, [])

  const cancel = useCallback(() => {
    if (!inFlight.current) dispatch({ type: 'CANCEL' })
  }, [])

  /** "Enviar pedido": revalida a cotação e só então envia. */
  const send = () => {
    if (state.status !== 'reviewing') return
    const snapshot = state.review
    void guarded(async () => {
      dispatch({ type: 'SEND' })
      await revalidateAndSubmit(snapshot)
    })
  }

  /** "Confirmar novos valores" no diálogo de mudanças: nova confirmação do usuário. */
  const acceptChanges = () => {
    if (state.status !== 'changed' || state.blocking) return
    const snapshot = { ...state.review, quote: state.quote }
    void guarded(async () => {
      dispatch({ type: 'ACCEPT_CHANGES' })
      await submit(snapshot)
    })
  }

  /** "Tentar de novo": revalida, ou reenvia o mesmo corpo com a mesma chave. */
  const retry = () => {
    if (state.status !== 'failed') return
    const { error, review: snapshot } = state
    if (error.kind === 'revalidation' && snapshot) {
      void guarded(async () => {
        dispatch({ type: 'RETRY' })
        await revalidateAndSubmit(snapshot)
      })
      return
    }
    const stored = attemptStorage.load(userId)
    if ((error.kind !== 'transient' && error.kind !== 'unverified') || !stored) return
    void guarded(async () => {
      dispatch({ type: 'RETRY' })
      const outcome = await sendWithRecovery(stored.input)
      await handleOutcome(outcome, snapshot, stored.input)
    })
  }

  // Funções mais recentes para a retomada, sem reiniciar o ciclo de vida quando mudam.
  const resume = useRef({ sendWithRecovery, handleOutcome })
  useEffect(() => {
    resume.current = { sendWithRecovery, handleOutcome }
  })

  // Ciclo de vida: sair da tela interrompe o backoff (o pedido já enviado segue na API).
  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    return () => controller.abort()
  }, [])

  // Retomada: envio sem resposta guardado (refresh, queda, novo login) volta a ser verificado
  // com o mesmo corpo e a mesma chave, sem esperar ação do usuário.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      await Promise.resolve()
      const stored = attemptStorage.load(userId)
      if (cancelled || inFlight.current || !stored?.uncertain) return
      inFlight.current = true
      try {
        dispatch({ type: 'SUBMIT', review: null })
        dispatch({ type: 'RECOVERING', attempt: 1 })
        const outcome = await resume.current.sendWithRecovery(stored.input)
        await resume.current.handleOutcome(outcome, null, stored.input)
      } finally {
        inFlight.current = false
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  return { state, openReview, cancel, send, acceptChanges, retry }
}
