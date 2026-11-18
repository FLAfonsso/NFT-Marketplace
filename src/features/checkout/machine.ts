import type {
  CartItem,
  CollectorFormFields,
  Network,
  Order,
  Quote,
  Wallet,
  WalletType,
} from '@/contracts'
import type { QuoteChange } from './quoteChanges'

/**
 * Máquina de estados do envio do pedido.
 *
 *   editing ──REVIEW──▶ reviewing ──SEND──▶ revalidating ──SUBMIT──▶ submitting ──ORDER──▶ pending
 *      ▲                    │                     │                     │ ▲                 confirmed
 *      └──────CANCEL────────┘                     ▼                     │ └─RECOVERING      rejected
 *                                              changed ◀─QUOTE_CHANGED──┤
 *                                       (ACCEPT_CHANGES ▶ submitting)   └──FAIL──▶ failed (RETRY ▶ submitting)
 *
 * - O pedido só sai de "submitting", e só se chega lá por "revalidating" (cotação conferida) ou
 *   por "changed" (o usuário aceitou os novos valores).
 * - Eventos fora da tabela são ignorados: um clique atrasado não pula etapas.
 */

/** Tudo o que o usuário viu e confirmou no diálogo de revisão. */
export interface ReviewSnapshot {
  quote: Quote
  items: CartItem[]
  couponCode: string | null
  wallet: Wallet
  provider: WalletType
  network: Network
  form: CollectorFormFields
}

export type CheckoutErrorKind =
  /** Rede ou 5xx: "Tentar de novo" reenvia o mesmo corpo com a mesma chave. */
  | 'transient'
  /** Falha ao revalidar a cotação: "Tentar de novo" revalida. */
  | 'revalidation'
  /** Timeout persistente: segue verificando o mesmo pedido com a mesma chave. */
  | 'unverified'
  /** Chave de idempotência usada com outro conteúdo. */
  | 'key_conflict'
  /** Dados recusados (400): vão para os campos. */
  | 'validation'
  /** Outros erros definitivos (403, 404...). */
  | 'other'

export interface CheckoutError {
  kind: CheckoutErrorKind
  message: string
}

export type CheckoutState =
  | { status: 'editing'; error: CheckoutError | null }
  | { status: 'reviewing'; review: ReviewSnapshot }
  | { status: 'revalidating'; review: ReviewSnapshot }
  | {
      status: 'changed'
      review: ReviewSnapshot
      /** Cotação nova que substitui a revisada se o usuário aceitar. */
      quote: Quote
      changes: QuoteChange[]
      /** Item esgotado ou acima do disponível: precisa ajustar o carrinho. */
      blocking: boolean
      reason: string
    }
  | {
      status: 'submitting'
      /** Ausente quando a recuperação começa sozinha (refresh com envio sem resposta). */
      review: ReviewSnapshot | null
      /** > 0: reenvio com a mesma chave depois de timeout ou queda ("Verificando seu pedido..."). */
      attempt: number
    }
  | { status: 'pending'; order: Order }
  | { status: 'confirmed'; order: Order }
  | { status: 'rejected'; order: Order }
  | { status: 'failed'; review: ReviewSnapshot | null; error: CheckoutError }

export type CheckoutStatus = CheckoutState['status']

export type CheckoutEvent =
  | { type: 'REVIEW'; review: ReviewSnapshot }
  | { type: 'CANCEL' }
  | { type: 'SEND' }
  | { type: 'QUOTE_CHANGED'; quote: Quote; changes: QuoteChange[]; blocking: boolean; reason: string }
  | { type: 'ACCEPT_CHANGES' }
  | { type: 'SUBMIT'; review: ReviewSnapshot | null }
  | { type: 'RECOVERING'; attempt: number }
  | { type: 'ORDER'; order: Order }
  | { type: 'FAIL'; error: CheckoutError }
  | { type: 'RETRY' }

export const initialCheckoutState: CheckoutState = { status: 'editing', error: null }

const reviewOf = (state: CheckoutState): ReviewSnapshot | null =>
  'review' in state ? state.review : null

export function checkoutReducer(state: CheckoutState, event: CheckoutEvent): CheckoutState {
  switch (event.type) {
    case 'REVIEW':
      return state.status === 'editing' || state.status === 'rejected' || state.status === 'failed'
        ? { status: 'reviewing', review: event.review }
        : state

    case 'CANCEL':
      return state.status === 'reviewing' || state.status === 'changed' || state.status === 'failed'
        ? {
            status: 'editing',
            // Erros de campo continuam visíveis depois de fechar o diálogo.
            error: state.status === 'failed' && state.error.kind === 'validation' ? state.error : null,
          }
        : state

    case 'SEND':
      return state.status === 'reviewing' ? { status: 'revalidating', review: state.review } : state

    case 'QUOTE_CHANGED': {
      const review = reviewOf(state)
      return (state.status === 'revalidating' || state.status === 'submitting') && review
        ? {
            status: 'changed',
            review,
            quote: event.quote,
            changes: event.changes,
            blocking: event.blocking,
            reason: event.reason,
          }
        : state
    }

    case 'ACCEPT_CHANGES':
      return state.status === 'changed' && !state.blocking
        ? { status: 'submitting', review: { ...state.review, quote: state.quote }, attempt: 0 }
        : state

    case 'SUBMIT':
      return state.status === 'revalidating' ||
        state.status === 'submitting' ||
        state.status === 'editing' ||
        state.status === 'failed'
        ? { status: 'submitting', review: event.review ?? reviewOf(state), attempt: 0 }
        : state

    case 'RECOVERING':
      return state.status === 'submitting' ? { ...state, attempt: event.attempt } : state

    case 'ORDER':
      return state.status === 'submitting' || state.status === 'failed'
        ? { status: event.order.status, order: event.order }
        : state

    case 'FAIL':
      if (state.status === 'revalidating' || state.status === 'submitting') {
        return event.error.kind === 'validation'
          ? { status: 'editing', error: event.error }
          : { status: 'failed', review: reviewOf(state), error: event.error }
      }
      return state

    case 'RETRY':
      return state.status === 'failed'
        ? state.error.kind === 'revalidation' && state.review
          ? { status: 'revalidating', review: state.review }
          : { status: 'submitting', review: state.review, attempt: 0 }
        : state
  }
}

/** Estados em que o pedido está saindo: nada de novo envio, nem de editar o carrinho. */
export const isBusy = (state: CheckoutState) =>
  state.status === 'revalidating' || state.status === 'submitting' || state.status === 'pending'
