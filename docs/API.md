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

Todas as rotas podem responder 5xx `transient` ou falha de rede quando um cenário de falha está ativo. Cenários nomeados: [SCENARIOS.md](SCENARIOS.md).

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
| GET | `/nfts/:id` | não | — | 200 `Nft` | 404 |

Query de `/nfts` (todos combináveis):

- `q`: busca sem acento e sem caixa em nome, criador, coleção e descrição.
- `view`: `all` (padrão), `new` (criados até 7 dias antes do NFT mais recente do catálogo) ou `trending` (os 12 com mais avaliações). Recorta o catálogo antes dos demais filtros.
- `collections`: ids (slugs) das coleções, ex.: `arte-digital`, `musica`. Chave repetida (`collections=a&collections=b`), `collections[]=a` ou separada por vírgula (`collections=a,b`). Várias coleções são alternativas (OU).
- `networks`: `ethereum`, `polygon`, `base`, mesmo formato de lista. Várias redes são alternativas (OU).
- `priceMin`, `priceMax`: `EthString`, inclusivos (`priceMin ≤ preço ≤ priceMax`), comparados com decimal.js, nunca como texto ou `number`. Cada ponta é opcional e vale sozinha. `priceMin > priceMax` → 400 (`fieldErrors.priceMin`). O filtro entra em `items`, `total`, `totalPages` e nas contagens de `facets`. Na tela Início, os mesmos valores ficam nos search params de `/`: a faixa completa (0.02 a 12.30) não grava nenhum dos dois, e valores fora da faixa ou com min > max são normalizados antes da consulta (limitados à faixa; pontas trocadas), de modo que a API só recebe faixa válida.
- `sort`: `recent` (padrão), `price_asc`, `price_desc`, `name_asc`. Desempate por `id`.
- `page` (padrão 1), `pageSize` (padrão **9**, máx. 48). Página além do fim devolve `items: []`.

`NftListResponse`: `items`, `page`, `pageSize`, `total`, `totalPages` e `facets`. `total`, `totalPages` e as contagens de `facets` consideram todos os filtros ativos, preço incluído (cada grupo de facet ignora só o filtro do próprio grupo).

`facets` traz `collections` e `networks`, cada um uma lista `{ id, name, count }` com **todas** as opções (inclusive `count: 0`). A contagem respeita todos os filtros ativos (`q`, `view`, preço e o outro grupo), **exceto o filtro do próprio grupo**: assim, com uma coleção marcada, as demais mostram quantos itens teriam ao serem marcadas também. Sem filtro de grupo, a soma das contagens é `total`.

`Nft` (campos novos em relação à versão anterior): `network`, `collection` (slug) e `collectionName`, `badge` (`"RARO"`, opcional), `tokenId` (só dígitos, `#314` → `"0314"`), `gallery` (exatamente 4 imagens, substitui `images`), `attributes` (`{ traitType, value }[]`), `compareAtPrice` (opcional, preço antigo riscado), `rating` (`{ average, count }`) e `editions` (sempre 4, nomes `1/1`, `1/10`, `1/50` e `ABERTA`, cada uma com `available`). `category` foi removido e `GET /nfts/categories` deixou de existir: use as `facets`.

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
- `networkFee` é fixa: `"0.016"` ETH quando há pelo menos um item e `"0"` com carrinho vazio, independente do número de linhas. O pedido guarda no snapshot a taxa da cotação usada. Ex.: carrinho da Ana (2 + 6 + 9 unidades) → `subtotal "26.83"`, `discount "0"`, `networkFee "0.016"`, `total "26.846"`.
- `total = subtotal − discount + networkFee`.
- `warnings`:
  - `unavailable`: quantidade pedida maior que `available` (a cotação é emitida, o pedido será recusado com 409).
  - `price_changed`: o preço difere do que este usuário/visitante viu na cotação anterior do mesmo item.
- Erros: item repetido ou acima de `maxPerOrder` → 400 (`fieldErrors["items.N.quantity"]`); NFT/edição inexistente → 404.
- Validade: 5 min (`expiresAt`). A cotação é de uso único e pertence a quem a pediu.

## Pedidos

| Método | Caminho | Auth | Entrada | Saída | Erros |
|---|---|---|---|---|---|
| POST | `/orders` | sim | cabeçalho `Idempotency-Key: <uuid>` + `CreateOrderInput` (ver abaixo) | 201 `Order` (novo) ou 200 `Order` (repetição) | 400, 401, 403, 404, 409 |
| GET | `/orders` | sim | — | 200 `OrderList` (mais recente primeiro) | 401 |
| GET | `/orders/:id` | sim | — | 200 `Order` | 401, 403, 404 |

`CreateOrderInput` = `idempotencyKey`, `quoteId`, `items`, `couponCode?`, `walletId` + os campos do formulário do colecionador (`CollectorFormFields`): `displayName`, `username`, `network`, `profileName`, `address`, `secondaryWallet?` (ENS ou endereço), `walletType` (`MetaMask`, `WalletConnect` ou `Coinbase Wallet`), `referralCode`, `email`, `ensName` e `note?`. Código de indicação e nome ENS são obrigatórios, como no layout. O recibo (`snapshot.buyer`) guarda `{ name: displayName, email }`.

Criação, na ordem:

1. `Idempotency-Key` é obrigatório e igual a `idempotencyKey` do corpo → senão 400.
2. **Idempotência** (por usuário, antes de qualquer outra regra): mesma chave e mesmo conteúdo → 200 com o mesmo pedido, no estado atual, e cabeçalho `Idempotent-Replayed: true`. Mesma chave com conteúdo diferente → 409.
3. Cotação: inexistente → 404; de outra sessão → 403; vencida → 409; itens ou cupom diferentes da cotação → 409.
4. Carteira: inexistente → 404; de outro usuário → 403; `address` ou `network` diferentes da carteira → 400.
5. Preço atual diferente do cotado → 409 `OrderConflict` `{ reason: "price_changed", quote }`: a cotação antiga é descartada e `quote` é a nova (com aviso `price_changed`), pronta para confirmar. Estoque insuficiente ou esgotado → 409 `OrderConflict` `{ reason: "insufficient_stock" | "sold_out", nftId, editionId, available }`.
6. Reserva o estoque (emite `nft.updated`), cria o pedido `pending`, consome a cotação.

`OrderConflict` (`src/contracts/order.ts`) estende `ApiError`. Os demais 409 do pedido (chave reutilizada, cotação vencida ou divergente) são `ApiError` simples.

Ciclo de vida: após ~2,5 s o pedido vira `confirmed` (com `transactionRef`) ou `rejected` (com `rejectionReason`; o estoque reservado é devolvido). Ao confirmar, sai do carrinho só a quantidade comprada de cada item. O `snapshot` (recibo) é gravado na criação e nunca muda. Pedidos pendentes continuam a ser liquidados após refresh.

Pagamento recusado de forma determinística: carteira cujo endereço termina em `dead`.

## Perfil

| Método | Caminho | Auth | Entrada | Saída | Erros |
|---|---|---|---|---|---|
| GET | `/profile` | sim | — | 200 `Profile` | 401 |
| PATCH | `/profile` | sim | `UpdateProfileInput` | 200 `Profile` | 400, 401, 409 (`fieldErrors.email`, `username` ou `walletNickname`) |
| PATCH | `/profile/password` | sim | `ChangePasswordInput` | 204 | 400 (`fieldErrors.currentPassword` quando a atual está errada), 401 |
| PUT | `/profile/avatar` | sim | `multipart/form-data`, campo `file` (png, jpeg ou webp, até 2 MB) | 200 `Profile` | 400 (`fieldErrors.avatar`: tipo, tamanho ou imagem grande demais), 401 |
| DELETE | `/profile/avatar` | sim | — | 200 `Profile` (`avatarUrl: null`) | 401 |

- `PATCH` é o método usado pelo app em `/profile`, `/profile/password` e `/wallets/:id`. `PUT` nesses três caminhos continua aceito como alias (mesmo comportamento).
- Avatar (`/profile/avatar`): endpoint adicionado para a tela Perfil, só na camada de mocks (nenhum schema novo; a resposta é o `Profile`). A simulação guarda a imagem como data URL no `localStorage` (~500 KB). Por isso o app reduz a foto escolhida (até 2 MB) para um quadrado de até 256 px em WebP antes de enviar. A validação de tipo e tamanho também existe no cliente, para a mensagem de erro aparecer sem ida à rede.

- `Profile`: `displayName`, `username`, `email`, `ensName` (ou `null`), `walletNickname`, `avatarUrl`. `walletNickname` é o apelido da carteira **principal**: `null` se o usuário não tem carteira; ao salvar, renomeia a carteira principal (sem carteira principal, um valor não nulo → 409).
- Nome de usuário e e-mail são únicos (sem diferenciar caixa no nome de usuário).
- Cadastro (`/auth/register`) continua recebendo `name`: o nome de usuário inicial é derivado dele (`João Pé` → `joao_pe`, com sufixo numérico se já existir) e o ENS começa vazio.
- `avatarUrl`: ausente mantém, `null` remove, URL http(s) ou data URL de imagem (até ~500 KB) substitui.
- Trocar a senha encerra as outras sessões do usuário; a atual continua válida.

## Carteiras

| Método | Caminho | Auth | Entrada | Saída | Erros |
|---|---|---|---|---|---|
| GET | `/wallets` | sim | — | 200 `WalletList` | 401 |
| POST | `/wallets` | sim | `WalletInput` | 201 `Wallet` | 400, 401, 409 (endereço duplicado) |
| PATCH | `/wallets/:id` | sim | `WalletInput` | 200 `Wallet` | 400, 401, 403, 404, 409 |

- `WalletInput` = campos do formulário do colecionador (`CollectorFormFields`, os mesmos do pedido) + `nickname` (apelido da carteira) + `role` (`primary` ou `secondary`). `Wallet` acrescenta `id`, `createdAt` e `updatedAt`.
- Redes: `ethereum`, `polygon`, `base`.
- Sempre existe exatamente uma carteira `primary`: a primeira é promovida automaticamente; promover outra rebaixa a atual; rebaixar a única principal → 409.
- Endereço duplicado é comparado sem caixa.

### Conexão simulada (checkout)

| Método | Caminho | Auth | Entrada | Saída | Erros |
|---|---|---|---|---|---|
| POST | `/wallets/:id/connect` | sim | `WalletConnectInput` (`{ provider: WalletType }`) | 200 `WalletConnection` | 400, 401, 403 (recusa ou carteira de outro usuário), 404 |

- Simula o pedido de conexão ao provedor (WalletConnect, MetaMask, Coinbase Wallet) para uma carteira cadastrada. Não altera o banco.
- `WalletConnection` = `walletId`, `provider`, `address`, `network` (os da carteira) e `connectedAt`.
- Recusa do usuário na carteira: 403 `forbidden` ("A conexão foi recusada na carteira."), vinda do cenário `wallet-rejected` ([SCENARIOS.md](SCENARIOS.md)).
- Desconectar é só local (o cliente esquece a conexão); não há rota.
- Adicionado para a tela de Pagamento, que exige carteira conectada para confirmar a compra. Schemas em `src/contracts/wallet.ts`.

---

## Ambiente de mocks

- Ligado por `VITE_ENABLE_MOCKS=true` (`.env.local`, `.env.example`). `src/main.tsx` importa `src/mocks/browser.ts` dinamicamente e só renderiza depois de o worker iniciar.
- Estado em `localStorage` (`nft-marketplace:mocks:db`), sincronizado entre abas.
- Latência fixa padrão: 150 ms.

### Dados de demonstração

| Usuário | E-mail | Senha | Observação |
|---|---|---|---|
| Ana Souza | `ana@example.com` | `ana12345` | usuário `ana_souza`, ENS `ana.eth`, código de indicação `KURIO-ANA26`; carteira principal `Principal` (MetaMask, Ethereum) e secundária `Reserva` (WalletConnect, Polygon); carrinho com 2 itens, 3 favoritos, 1 pedido confirmado |
| Bruno Lima | `bruno@example.com` | `bruno12345` | usuário `bruno_lima`, ENS `bruno.eth`, código de indicação `KURIO-BRUNO26`; carteira principal `Principal` (Coinbase Wallet, Base) e secundária `Sem saldo` (termina em `dead`, recusa pagamentos) |

Os códigos de indicação são fictícios. Os endereços são `0x` + 40 hexadecimais.

Cupons: `BEMVINDO10` (10 %, teto 0.5 ETH), `MENOS005` (0.005 ETH), `BLACKFRIDAY25` (expirado), `NAOEXISTE` (inexistente).

Catálogo: 36 NFTs (`nft_001`…`nft_036`, 4 páginas de 9), 9 coleções (Arte digital, Fotografia, Música, Arte 3D, Colecionáveis, Generativa, Jogos, Assinaturas, Utilidade), 3 redes, 4 edições por NFT (`1/1`, `1/10`, `1/50`, `ABERTA`), preços de 0.02 a 12.30 ETH, alguns NFTs totalmente esgotados e outros com edições esgotadas.

NFTs nomeados no design: Emerald Ape #042 (`nft_001`, badge `RARO`, nota 4.8 com 19 avaliações), Sage Nomad #009, Neon Vessel #552 (1.99, `compareAtPrice` 2.29), Cosmic Bloom #118, Violet Nomad #314, Ivory Baron #088, Golden Beat #207 e Golden Signal #160. Violet Nomad e Ivory Baron têm estoque de pelo menos 9 unidades nas edições `1/10`, `1/50` e `ABERTA`. As imagens são arquivos de `public/assets` (`/assets/Eape.png`, `Sape.png`, `Nape.png`, `Gape.png`): Emerald Ape usa Eape, Sage Nomad usa Sape, Neon Vessel e Ivory Baron usam Nape, Golden Beat e Golden Signal usam Gape; os demais alternam entre as quatro. Cada `gallery` tem 4 imagens (a principal primeiro). O seed é determinístico (versão do esquema 5: estado salvo por versões anteriores no `localStorage` é descartado).

### Controles (`window.__mocks`)

Para demonstração e Playwright (`page.evaluate`). O app não usa.

| Função | Efeito |
|---|---|
| `setScenario(nome, opções?)` / `getScenario()` / `listScenarios()` | cenários nomeados; ver [SCENARIOS.md](SCENARIOS.md) |
| `reset()` | restaura exatamente o seed, as configurações padrão e o cenário `default` |
| `configure({ latencyMs, sessionTtlMs, quoteTtlMs, orderSettleMs })` | ajusta a simulação |
| `failNext({ method?, path?, status, times, afterHandler? })` | próximas `times` requisições casadas falham com `status` (5xx) ou `'network'`. `afterHandler: true` executa o efeito e falha depois (timeout após criar o pedido) |
| `expireSessions(userId?)` | expira sessões |
| `setNftPrice(nftId, price)` | altera o preço (emite `nft.updated`) |
| `setEditionAvailable(nftId, editionId, n)` | altera o estoque (emite `nft.updated`) |
