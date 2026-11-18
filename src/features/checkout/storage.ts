import { z } from 'zod'
import { CreateOrderInput } from '@/contracts'
import { CHECKOUT_FIELDS, type CheckoutFormValues } from './schema'

/**
 * Persistência do checkout, sempre por usuário e tolerante a storage indisponível.
 *
 * - Rascunho do formulário: sessionStorage (some ao fechar a aba). Só os campos do formulário,
 *   por lista explícita: nenhum dado de senha entra aqui. Apagado no logout.
 * - Tentativa de pedido (chave de idempotência + hash do conteúdo + corpo enviado) e pedido
 *   pendente: localStorage, para sobreviver a refresh, queda e novo login. Apagados só quando
 *   o pedido fica confirmado ou recusado.
 */

const PREFIX = 'nft-marketplace:checkout'
const draftKey = (userId: string) => `${PREFIX}:draft:${userId}`
const attemptKey = (userId: string) => `${PREFIX}:attempt:${userId}`
const pendingKey = (userId: string) => `${PREFIX}:pending-order:${userId}`

function readJson(storage: () => Storage, key: string): unknown {
  try {
    const raw = storage().getItem(key)
    return raw ? (JSON.parse(raw) as unknown) : null
  } catch {
    return null
  }
}

function write(storage: () => Storage, key: string, value: string | null) {
  try {
    if (value === null) storage().removeItem(key)
    else storage().setItem(key, value)
  } catch {
    // Sem storage, o estado vale só enquanto a página estiver aberta.
  }
}

const session = () => sessionStorage
const local = () => localStorage

// ---------------------------------------------------------------------------
// Rascunho
// ---------------------------------------------------------------------------

const DraftSchema = z
  .object({
    walletId: z.string(),
    displayName: z.string(),
    username: z.string(),
    network: z.string(),
    profileName: z.string(),
    address: z.string(),
    secondaryWallet: z.string(),
    walletType: z.string(),
    email: z.string(),
    referralCode: z.string(),
    ensLabel: z.string(),
    useOtherWallet: z.boolean(),
    note: z.string(),
  })
  .partial()

export type CheckoutDraft = z.infer<typeof DraftSchema>

export const draftStorage = {
  load(userId: string): CheckoutDraft | null {
    const parsed = DraftSchema.safeParse(readJson(session, draftKey(userId)))
    return parsed.success ? parsed.data : null
  },
  save(userId: string, values: Partial<CheckoutFormValues>) {
    // Lista explícita de campos: qualquer outro valor (ex.: senha) nunca é gravado.
    const draft = Object.fromEntries(
      CHECKOUT_FIELDS.filter((field) => values[field] !== undefined).map((f) => [f, values[f]]),
    )
    write(session, draftKey(userId), JSON.stringify(draft))
  },
  clear(userId: string) {
    write(session, draftKey(userId), null)
  },
}

/** Logout: apaga os rascunhos de todos os usuários desta aba (dados pessoais). */
export function clearCheckoutDrafts() {
  try {
    const keys = Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.key(i))
    for (const key of keys) {
      if (key?.startsWith(`${PREFIX}:draft:`)) sessionStorage.removeItem(key)
    }
  } catch {
    // Idem.
  }
}

// ---------------------------------------------------------------------------
// Tentativa de pedido (idempotência)
// ---------------------------------------------------------------------------

const OrderAttemptSchema = z.object({
  /** UUID enviado em Idempotency-Key. */
  key: z.uuid(),
  /** Hash de itens, quantidades, cupom, carteira e valores da cotação. */
  hash: z.string(),
  /** Último corpo enviado com esta chave (reenvio idêntico na recuperação). */
  input: CreateOrderInput,
  /**
   * true: o envio pode ter criado o pedido sem a resposta chegar (timeout, queda). A próxima
   * ação é reenviar o mesmo corpo com a mesma chave até recuperar o pedido.
   */
  uncertain: z.boolean(),
  /** A API recusou a chave (409, conteúdo diferente). A próxima confirmação gera outra. */
  conflict: z.boolean().optional(),
})
export type OrderAttempt = z.infer<typeof OrderAttemptSchema>

export const attemptStorage = {
  load(userId: string): OrderAttempt | null {
    const parsed = OrderAttemptSchema.safeParse(readJson(local, attemptKey(userId)))
    return parsed.success ? parsed.data : null
  },
  save(userId: string, attempt: OrderAttempt) {
    write(local, attemptKey(userId), JSON.stringify(attempt))
  },
  update(userId: string, patch: Partial<OrderAttempt>) {
    const current = attemptStorage.load(userId)
    if (current) attemptStorage.save(userId, { ...current, ...patch })
  },
  clear(userId: string) {
    write(local, attemptKey(userId), null)
  },
}

// ---------------------------------------------------------------------------
// Pedido pendente
// ---------------------------------------------------------------------------

export const pendingOrderStorage = {
  load(userId: string): string | null {
    const value = readJson(local, pendingKey(userId))
    return typeof value === 'string' && value ? value : null
  },
  save(userId: string, orderId: string) {
    write(local, pendingKey(userId), JSON.stringify(orderId))
  },
  clear(userId: string) {
    write(local, pendingKey(userId), null)
  },
}

/** Pedido terminou (confirmado ou recusado): a chave e o pendente deixam de valer. */
export function forgetOrderAttempt(userId: string) {
  attemptStorage.clear(userId)
  pendingOrderStorage.clear(userId)
}
