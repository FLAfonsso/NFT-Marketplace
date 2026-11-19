import { expireSessions } from './db/auth'
import { read, updateNft, withoutEvents, type SettlementOutcome } from './db/store'
import { emitNftUpdate, emitOrderUpdate, realtimeControl, type NftUpdateInput } from './realtime/control'
import { getScenario, listScenarios, reset, setScenario } from './scenarios'
import { faults, mockSettings, type Fault, type MockSettings } from './settings'

/**
 * Controles da simulação para demonstração e testes (Playwright usa via page.evaluate).
 * Exposto como window.__mocks em src/mocks/browser.ts. Nada aqui é usado pelo app.
 */
export const mockControl = {
  /** Ativa um cenário de src/mocks/scenarios do zero. Ex.: setScenario('jitter', { seed: 42 }). */
  setScenario,
  /** Cenário ativo, seed, opções e runtime. */
  getScenario,
  /** Nome e efeito de cada cenário. */
  listScenarios,
  /** Restaura exatamente o seed, as configurações padrão e o cenário "default". */
  reset,
  /** Ajusta latência, validade de sessão/cotação e atraso de liquidação. */
  configure: (patch: Partial<MockSettings>) => Object.assign(mockSettings, patch),
  /** Faz as próximas `times` requisições que casarem falharem com 5xx ou erro de rede. */
  failNext: (fault: Fault) => {
    faults.push({ ...fault })
  },
  /** Expira as sessões de um usuário (ou de todos). */
  expireSessions,
  /** Muda o preço de um NFT (cenário "preço alterado durante a compra"). */
  setNftPrice: (nftId: string, price: string) =>
    updateNft(nftId, (nft) => {
      nft.price = price
    }),
  /** Muda o estoque de uma edição (cenário "edição esgotada durante a compra"). */
  setEditionAvailable: (nftId: string, editionId: string, available: number) =>
    updateNft(nftId, (nft) => {
      const edition = nft.editions.find((e) => e.id === editionId)
      if (edition) edition.available = Math.max(0, Math.min(edition.supply, Math.trunc(available)))
    }),
  /**
   * Diagnóstico somente leitura do TanStack Query (os testes verificam o isolamento por usuário):
   * chaves e dados de cada consulta e as variáveis das mutations. Não altera o cache.
   */
  inspectQueryCache: async () => {
    const { queryClient } = await import('@/lib/queryClient')
    return {
      queries: queryClient
        .getQueryCache()
        .getAll()
        .map((query) => ({ queryKey: query.queryKey, data: query.state.data })),
      mutations: queryClient
        .getMutationCache()
        .getAll()
        .map((mutation) => ({ variables: mutation.state.variables })),
    }
  },
  /**
   * Evento perdido: mesma mudança de emitNftUpdate (mesma validação, version +1 no store e no
   * REST), mas SEM emitir nft.updated. Simula a mudança que acontece durante uma queda do socket;
   * o app só a descobre pela reconciliação REST. Devolve o NFT como o REST passa a responder.
   */
  updateNftSilently: (input: NftUpdateInput) => {
    withoutEvents(() => emitNftUpdate(input))
    return structuredClone(read().nfts.find((n) => n.id === input.nftId))
  },
  /**
   * Evento perdido: liquida um pedido pendente como emitOrderUpdate (estoque, carrinho, version
   * +1), mas SEM emitir order.updated nem o nft.updated da devolução de estoque. Para segurar o
   * pedido em "pending" até aqui, use antes configure({ orderSettleMs: <alto> }).
   * Devolve o pedido como o REST passa a responder.
   */
  settleOrderSilently: (orderId: string, status: SettlementOutcome) => {
    withoutEvents(() => emitOrderUpdate({ orderId, status }))
    return structuredClone(read().orders.find((r) => r.order.id === orderId)?.order)
  },
  /**
   * Tempo real (docs/REALTIME.md): emitNftUpdate, emitOrderUpdate, emitDuplicate, emitStale,
   * disconnectSockets, reconnectSockets, listSockets, socketStats e probe.
   */
  ...realtimeControl,
}

export type MockControl = typeof mockControl
