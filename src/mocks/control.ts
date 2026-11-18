import { expireSessions } from './db/auth'
import { updateNft } from './db/store'
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
}

export type MockControl = typeof mockControl
