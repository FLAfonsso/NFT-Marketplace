import { toast } from 'sonner'

/** Ação fora do escopo: avisa e nunca finge sucesso. Id fixo evita toasts empilhados. */
export const notifyUnavailable = () => toast('Indisponível nesta versão', { id: 'unavailable' })
