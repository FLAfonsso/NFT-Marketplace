# API REST (simulada com MSW)

Base: `/api`. Corpos em JSON. Schemas em `src/contracts` (nomes abaixo entre crases). Implementação em `src/mocks/handlers`.

## Convenções

- **Autenticação**: `Authorization: Bearer <token>`. O token é opaco e expira em 30 min (`Session.expiresAt`).
- **Visitante**: rotas de carrinho e cotação aceitam, sem login, o cabeçalho `X-Guest-Cart-Id: <uuid>` gerado pelo cliente. Se `Authorization` vier, a sessão precisa ser válida (não cai para visitante).
- **ETH**: sempre string decimal (`EthString`), até 18 casas. Contas com decimal.js, arredondamento para baixo.
- **Versão**: `Nft`, `Cart`, `Order` e `Profile` têm `version` monotônica.
- **Erros**: todo erro responde `ApiError` `{ code, message, fieldErrors? }`. `fieldErrors` é chaveado pelo caminho do campo (`email`, `items.0.quantity`).

| code | status | quando |
|---|---|---|
| `validation` | 400 | corpo/query inválidos, JSON malformado, regra de formulário |
| `unauthorized` | 401 | sem token, token inválido, sessão expirada, login incorreto |
| `forbidden` | 403 | recurso de outro usuário (pedido, carteira, cotação) |
| `not_found` | 404 | recurso inexistente ou rota desconhecida em `/api/*` |
| `conflict` | 409 | e-mail/carteira duplicados, estoque, preço mudou, cotação vencida, chave de idempotência reutilizada |
| `transient` | 500/502/503/504 | falha transitória (injetada pelos controles; ver abaixo) |

Todas as rotas podem responder 5xx `transient` ou falha de rede quando um cenário de falha está ativo.

---

## Sessão e conta

| Método | Caminho | Auth | Entrada | Saída | Erros |
|---|---|---|---|---|---|
| POST | `/auth/register` | não | `RegisterInput`; opcional `X-Guest-Cart-Id` | 201 `Session` | 400, 409 (`fieldErrors.email`) |
| POST | `/auth/login` | não | `LoginInput`; opcional `X-Guest-Cart-Id` | 200 `Session` | 400, 401 (e-mail ou senha incorretos) |
| GET | `/auth/session` | sim | — | 200 `Session` (mesmo token) | 401 (`message` indica expirada ou inválida) |
| POST | `/auth/logout` | opcional | — | 204 | — (idempotente) |

Com `X-Guest-Cart-Id`, cadastro e login **mesclam** o carrinho de visitante no do usuário: quantidades somadas (limitadas a `maxPerOrder`), cupom do usuário preservado (ou o do visitante adotado), carrinho de visitante apagado.

Senhas são guardadas como PBKDF2-SHA256 (Web Crypto, 100 000 iterações, salt aleatório).

## NFTs

| Método | Caminho | Auth | Entrada | Saída | Erros |
|---|---|---|---|---|---|
| GET | `/nfts` | não | query `NftListQuery` | 200 `NftListResponse` | 400 |
| GET | `/nfts/categories` | não | — | 200 `NftCategoryList` | — |
| GET | `/nfts/:id` | não | — | 200 `Nft` | 404 |

Query de `/nfts` (todos combináveis):

- `q`: busca sem acento e sem caixa em nome, criador e descrição.
- `category`: igualdade (sem acento/caixa).
- `minPrice`, `maxPrice`: `EthString`, inclusivos. `minPrice > maxPrice` → 400.
- `availableOnly=true`: ao menos uma edição com `available > 0`.
- `sort`: `recent` (padrão), `price_asc`, `price_desc`, `name_asc`. Desempate por `id`.
- `page` (padrão 1), `pageSize` (padrão 12, máx. 48). Página além do fim devolve `items: []`.

## Favoritos

| Método | Caminho | Auth | Entrada | Saída | Erros |
|---|---|---|---|---|---|
| GET | `/favorites` | sim | — | 200 `FavoriteList` (mais recente primeiro) | 401 |
| PUT | `/favorites/:nftId` | sim | — | 200 `FavoriteList` | 401, 404 |
| DELETE | `/favorites/:nftId` | sim | — | 200 `FavoriteList` | 401 |

PUT e DELETE são idempotentes.

## Carrinho

Usuário autenticado ou visitante (`X-Guest-Cart-Id`). Sem nenhum dos dois → 401. O carrinho é criado vazio no primeiro acesso.

| Método | Caminho | Entrada | Saída | Erros |
|---|---|---|---|---|
| GET | `/cart` | — | 200 `Cart` | 400 (guest id inválido), 401 |
| POST | `/cart/items` | `AddCartItemInput` | 201 `Cart` | 400, 401, 404, 409 |
| PATCH | `/cart/items` | `UpdateCartItemInput` | 200 `Cart` | 400, 401, 404 (item fora do carrinho), 409 |
| DELETE | `/cart/items/:nftId/:editionId` | — | 200 `Cart` | 401 (idempotente) |
| PUT | `/cart/coupon` | `SetCartCouponInput` (`null` remove) | 200 `Cart` | 400, 401 |

- POST soma à quantidade existente do par `nftId + editionId`; PATCH define a quantidade.
- Quantidade final acima de `maxPerOrder` → 400 (`fieldErrors.quantity`). Edição esgotada ou acima de `available` → 409.
- O cupom guardado não é validado aqui; a validade aparece na cotação.

## Cotação

| Método | Caminho | Auth | Entrada | Saída | Erros |
|---|---|---|---|---|---|
| POST | `/quote` | usuário ou visitante | `QuoteRequest` | 200 `Quote` | 400, 401, 404 |

- `unitPrice` = preço atual do NFT; `lineTotal = unitPrice × quantity`; `subtotal` = soma das linhas.
- Cupom (`coupon`): `applied`, `expired` ou `invalid` (inexistente). Cupom inválido **não** é erro: a cotação vem com `discount: "0"`.
  - Percentual: `subtotal × %`, limitado ao teto do cupom. Fixo: valor em ETH. Nunca maior que o subtotal.
- `networkFee` = `0.0012 + 0.0003 × (linhas − 1)`.
- `total = subtotal − discount + networkFee`.
- `warnings`:
  - `unavailable`: quantidade pedida maior que `available` (a cotação é emitida, o pedido será recusado com 409).
  - `price_changed`: o preço difere do que este usuário/visitante viu na cotação anterior do mesmo item.
- Erros: item repetido ou acima de `maxPerOrder` → 400 (`fieldErrors["items.N.quantity"]`); NFT/edição inexistente → 404.
- Validade: 5 min (`expiresAt`). A cotação é de uso único e pertence a quem a pediu.

## Pedidos

| Método | Caminho | Auth | Entrada | Saída | Erros |
|---|---|---|---|---|---|
| POST | `/orders` | sim | cabeçalho `Idempotency-Key: <uuid>` + `CreateOrderInput` | 201 `Order` (novo) ou 200 `Order` (repetição) | 400, 401, 403, 404, 409 |
| GET | `/orders` | sim | — | 200 `OrderList` (mais recente primeiro) | 401 |
| GET | `/orders/:id` | sim | — | 200 `Order` | 401, 403, 404 |

Criação, na ordem:

1. `Idempotency-Key` é obrigatório e igual a `idempotencyKey` do corpo → senão 400.
2. **Idempotência** (por usuário, antes de qualquer outra regra): mesma chave e mesmo conteúdo → 200 com o mesmo pedido, no estado atual, e cabeçalho `Idempotent-Replayed: true`. Mesma chave com conteúdo diferente → 409.
3. Cotação: inexistente → 404; de outra sessão → 403; vencida → 409; itens ou cupom diferentes da cotação → 409.
4. Carteira: inexistente → 404; de outro usuário → 403; `network` diferente da carteira → 400.
5. Preço atual diferente do cotado → 409. Estoque insuficiente ou esgotado → 409.
6. Reserva o estoque (emite `nft.updated`), cria o pedido `pending`, consome a cotação.

Ciclo de vida: após ~2,5 s o pedido vira `confirmed` (com `transactionRef`) ou `rejected` (com `rejectionReason`; o estoque reservado é devolvido). Ao confirmar, sai do carrinho só a quantidade comprada de cada item. O `snapshot` (recibo) é gravado na criação e nunca muda. Pedidos pendentes continuam a ser liquidados após refresh.

Pagamento recusado de forma determinística: carteira cujo endereço termina em `dead`.

## Perfil

| Método | Caminho | Auth | Entrada | Saída | Erros |
|---|---|---|---|---|---|
| GET | `/profile` | sim | — | 200 `Profile` | 401 |
| PUT | `/profile` | sim | `UpdateProfileInput` | 200 `Profile` | 400, 401, 409 (`fieldErrors.email`) |
| PUT | `/profile/password` | sim | `ChangePasswordInput` | 204 | 400 (`fieldErrors.currentPassword` quando a atual está errada), 401 |

- `avatarUrl`: ausente mantém, `null` remove, URL http(s) ou data URL de imagem (até ~500 KB) substitui.
- Trocar a senha encerra as outras sessões do usuário; a atual continua válida.

## Carteiras

| Método | Caminho | Auth | Entrada | Saída | Erros |
|---|---|---|---|---|---|
| GET | `/wallets` | sim | — | 200 `WalletList` | 401 |
| POST | `/wallets` | sim | `WalletInput` | 201 `Wallet` | 400, 401, 409 (endereço duplicado) |
| PUT | `/wallets/:id` | sim | `WalletInput` | 200 `Wallet` | 400, 401, 403, 404, 409 |

- Sempre existe exatamente uma carteira `primary`: a primeira é promovida automaticamente; promover outra rebaixa a atual; rebaixar a única principal → 409.
- Endereço duplicado é comparado sem caixa.

---

## Ambiente de mocks

- Ligado por `VITE_ENABLE_MOCKS=true` (`.env.local`, `.env.example`). `src/main.tsx` importa `src/mocks/browser.ts` dinamicamente e só renderiza depois de o worker iniciar.
- Estado em `localStorage` (`nft-marketplace:mocks:db`), sincronizado entre abas.
- Latência fixa padrão: 150 ms.

### Dados de demonstração

| Usuário | E-mail | Senha | Observação |
|---|---|---|---|
| Ana Souza | `ana@example.com` | `ana12345` | carrinho com 2 itens, 3 favoritos, 1 pedido confirmado |
| Bruno Lima | `bruno@example.com` | `bruno12345` | carteira `Sem saldo` (termina em `dead`) recusa pagamentos |

Cupons: `BEMVINDO10` (10 %, teto 0.5 ETH), `MENOS005` (0.005 ETH), `BLACKFRIDAY25` (expirado), `NAOEXISTE` (inexistente).

Catálogo: 48 NFTs (`nft_001`…`nft_048`), 6 categorias, 1 a 3 edições cada, preços de 0.005 a 12.5 ETH, alguns totalmente esgotados e outros com edições esgotadas.

### Controles (`window.__mocks`)

Para demonstração e Playwright (`page.evaluate`). O app não usa.

| Função | Efeito |
|---|---|
| `reset()` | restaura exatamente o seed e as configurações padrão |
| `configure({ latencyMs, sessionTtlMs, quoteTtlMs, orderSettleMs })` | ajusta a simulação |
| `failNext({ method?, path?, status, times, afterHandler? })` | próximas `times` requisições casadas falham com `status` (5xx) ou `'network'`. `afterHandler: true` executa o efeito e falha depois (timeout após criar o pedido) |
| `expireSessions(userId?)` | expira sessões |
| `setNftPrice(nftId, price)` | altera o preço (emite `nft.updated`) |
| `setEditionAvailable(nftId, editionId, n)` | altera o estoque (emite `nft.updated`) |
