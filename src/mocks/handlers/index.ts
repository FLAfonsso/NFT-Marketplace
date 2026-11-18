import { http } from 'msw'
import { authHandlers } from './auth'
import { cartHandlers } from './cart'
import { favoriteHandlers } from './favorites'
import { nftHandlers } from './nfts'
import { orderHandlers } from './orders'
import { profileHandlers } from './profile'
import { quoteHandlers } from './quote'
import { API, fail, route } from './utils'
import { walletHandlers } from './wallets'

export const handlers = [
  ...authHandlers,
  ...nftHandlers,
  ...favoriteHandlers,
  ...cartHandlers,
  ...quoteHandlers,
  ...orderHandlers,
  ...profileHandlers,
  ...walletHandlers,
  // Qualquer outra rota da API responde 404 no formato ApiError, em vez de vazar para a rede.
  http.all(
    `${API}/*`,
    route(() => fail('not_found', 'Rota não encontrada.')),
  ),
]
