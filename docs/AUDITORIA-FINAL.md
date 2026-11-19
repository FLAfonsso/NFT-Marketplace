# Auditoria final — NFT Marketplace (Kurio) × docs/SPEC.md

Data: 2026-11-19 · Commit auditado: `b4152e3` (main, igual a origin/main) · Auditoria só de leitura: nenhum arquivo do projeto foi alterado além deste.

## Como a auditoria foi feita

| Verificação | Resultado |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm build` | exit 0 (`dist/` com `mockServiceWorker.js`, PNGs e woff2 do Roboto Mono) |
| Suíte E2E | **não rodada** (pedido do usuário). Último resultado conhecido: 340 passaram e 4 foram pulados, como esperado (`test.skip` em `e2e/a11y.spec.ts:109`, `:147` e `e2e/purchase.spec.ts:438`, que dependem do viewport) |
| Navegador | `pnpm preview --port 4173` + Chromium headless (script descartável fora do repo) em 1440×900 e 390×844: início, detalhe, 404, login, cadastro, carrinho, checkout, perfil, carteiras e pedido `ord_seed_1`, mais o cenário `slow` para os skeletons. Servidor parado ao final |
| Deploy público | `curl` nas rotas e Chromium headless em https://nft-marketplace-delta-ruby.vercel.app |
| Buscas no código | `fetch(`/`XMLHttpRequest`/`WebSocket`/`EventSource` fora de `src/mocks`; imports de `src/mocks`; `parseFloat`/`Number(`/`toFixed`/aritmética em ETH; `setQueryData` fora de mutations e tempo real; dados fictícios fora de `src/mocks` |

---

## 1. Resumo executivo

**Nenhuma violação eliminatória encontrada.** As seis condições da seção 11 foram verificadas com busca ativa e estão atendidas (detalhes na seção 2).

| Status | Quantidade |
|---|---|
| ATENDE | 229 |
| PARCIAL | 24 |
| NÃO ATENDE | 5 (8.6 skeletons, 10.3 Performance mobile, 12.6 README sem setup, 12.17 e 12.18 ARCHITECTURE.md sem limitações nem decisões de UX) |
| NÃO VERIFICÁVEL | 1 na tabela (12.3) + 3 itens complementares na seção 5 |
| **Linhas na tabela de requisitos** | **259** |

Os 5 NÃO ATENDE vêm de 3 causas: skeleton quebrado, Performance mobile e documentação de entrega (README/ARCHITECTURE).

Principais achados (em ordem de impacto na nota):

1. **Os skeletons estão invisíveis (NÃO ATENDE, seção 8).** A classe `.shimmer` do projeto (`src/index.css:113`) colide com a utility `shimmer` de `shadcn/tailwind.css` (importada em `src/index.css:3`), que aplica `background-clip: text`. O fundo do "osso" só seria pintado atrás de texto, e o skeleton não tem texto: no cenário `slow`, a grade do catálogo e as facetas da sidebar aparecem como **áreas vazias**. Medido no navegador: `backgroundColor rgb(61,42,29)`, `backgroundClip: "text"`, elemento visível no topo do `elementFromPoint`, mas nada pintado. Afeta os 9 componentes com `.shimmer` (catálogo, detalhe, hero, carrinho, cupom, resumo do checkout, carteiras do checkout). Os testes passam porque verificam caixa e animação, não a pintura.
2. **O README.md não atende a seção 12.** As linhas 1–75 ainda são o template do Vite ("React + TypeScript + Vite", em inglês). Faltam setup, variáveis de ambiente, credenciais fictícias, seleção e reset de cenários e a reprodução dos fluxos de falha (tudo existe em `docs/API.md` e `docs/SCENARIOS.md`, mas o README não aponta para lá). A tabela Lighthouse do README está defasada (53/97/57/89 contra 64/98/79/98 do `lighthouse/RESULTADOS.md`).
3. **O ARCHITECTURE.md tem 20 linhas** e só fala de favicon e meta tags. A SPEC exige ali limitações, decisões de UX e desvios do Figma, e pede a documentação da política de sessão, do estado do carrinho, da estratégia de cache e da reconciliação REST/Socket.IO. Parte disso está espalhada em `docs/design/screens.md`, `docs/API.md`, `docs/REALTIME.md` e em comentários (`src/lib/queryClient.ts:4-15`).
4. **`pnpm dev` num checkout limpo sobe sem mocks.** A flag `VITE_ENABLE_MOCKS=true` está em `.env.local`, que é ignorado pelo git; `.env.production` só vale para o build. Sem a flag, `src/main.tsx:28-31` desliga o MSW e o app fica sem API. Playwright e Lighthouse injetam a flag, então só o `pnpm dev` é afetado.
5. **Performance mobile abaixo da meta** (64 em `/` e 79 em `/nft/nft_003`). Está justificada e analisada em `lighthouse/RESULTADOS.md`, o que a SPEC aceita, mas custa pontos no critério.

Nota estimada: **≈ 84,5/100** (detalhe na seção 6).

---

## 2. Violações eliminatórias (seção 11)

> **Nenhuma encontrada.** Cada uma das condições abaixo foi procurada ativamente.

| # | Eliminatório | Status | Evidência |
|---|---|---|---|
| E1 | Uso efetivo da stack obrigatória | ATENDE | **React 19**: `src/main.tsx`. **TypeScript**: `tsc -b`, typecheck exit 0. **TanStack Router**: rotas por arquivo em `src/routes/*`, `validateSearch` + `stripSearchParams` em `src/routes/index.tsx:9-13`, guard `beforeLoad` em `src/routes/_authenticated.tsx`, `defaultNotFoundComponent` em `src/router.ts:18`. **TanStack Query**: `src/lib/queryClient.ts`, chaves em `src/lib/queryKeys.ts`, `useQuery`/`useMutation` em todas as features. **Axios**: `src/lib/api.ts:88` (`axios.create`) com interceptors e validação Zod (`parse`, linhas 111-123); **zero** `fetch`, `XMLHttpRequest`, `EventSource` ou `new WebSocket` em `src` fora de `src/mocks` (grep). O único outro import de `axios`, em `src/features/checkout/checkoutApi.ts:1`, usa só `axios.isAxiosError` para ler o 409. **Socket.IO client**: `src/features/realtime/socket.ts:84-92` (`io({ transports: ['websocket'] })`). **Tailwind 4**: `@tailwindcss/vite` em `vite.config.ts`. **shadcn/ui**: `components.json` e `src/components/ui/*` (dialog, sheet, select, tabs, slider...). **MSW**: `src/mocks/browser.ts` (`setupWorker`) + `@mswjs/socket.io-binding` em `src/mocks/realtime/socket.ts:1`. **Playwright**: `playwright.config.ts`, 13 specs em `e2e/`. **Lighthouse**: `lighthouse/run.mjs`, `pnpm lighthouse` |
| E2 | Fluxos principais não apenas visuais | ATENDE | Cada fluxo chama a API simulada pelo Axios: catálogo `src/features/catalog/nftApi.ts`; detalhe `useNft.ts`; carrinho `src/features/cart/cartApi.ts`; checkout e pedido `src/features/checkout/checkoutApi.ts:17-43`; login e cadastro `src/features/auth/authApi.ts`; perfil `src/features/profile/profileApi.ts`; carteiras `src/features/wallets/useWallets.ts`. Os testes observam as respostas reais dos handlers, p. ex. `e2e/cart.spec.ts` "1. valores do design: ... igual à cotação da API" e `e2e/catalog.spec.ts` "2. filtros combinados ... batem com a API" |
| E3 | Compra confirmada sem resposta da simulação | ATENDE | `src/features/orders/components/OrderPage.tsx:39`: `ReceiptView` só renderiza com `order.status === 'confirmed'`, e `order` vem só de `GET /orders/:id` (`useOrderStatus.ts:90-101`) ou de `order.updated` validado e versionado (`cacheSync.ts:107-139`). O checkout navega para `/orders/$id` (`useCheckoutFlow.ts:93`), que começa em pendente. Testes: `e2e/failures.spec.ts` "1. pagamento recusado: ... sem recibo"; `e2e/realtime.spec.ts` "14a. order.updated confirmed: recibo sem recarregar..." |
| E4 | Exposição de dados entre usuários | ATENDE | **Cache**: chaves `['user', userId, ...]` (`src/lib/queryKeys.ts:26-33`); `queryClient.clear()` no logout e na troca de usuário (`src/features/auth/session.ts:30-34, 38-42, 55-61`). **Storage**: chaves privadas sufixadas com o userId e apagadas (`src/lib/privateStorage.ts:64-83`), com bloqueio de regravação (`erased`). **Socket**: `closeSocket()` remove todos os listeners e desconecta (`src/features/realtime/socket.ts:119-132`); o efeito de sincronização reinicia por token e userId e limpa o `VersionTracker` (`useRealtimeSync.ts:94-101`); `order.updated` de outro usuário é descartado (`useRealtimeSync.ts:78`). **Salas**: `order.updated` vai só para `user:<id>`, com conferência de `conn.userId` e da sessão (`src/mocks/realtime/socket.ts:289-305`). **Recibos e carteiras**: 403/404 indistintos (`useOrderStatus.ts:69-70`). Testes: `e2e/account-session.spec.ts` "8. logout: ... não deixa dados da Ana em storage, cache nem socket" e "9. troca de usuário: nada da Ana aparece para o Bruno..."; `e2e/realtime.spec.ts` "18a", "18b", "19a"; `e2e/purchase.spec.ts` "15. acesso: ... outro usuário recebe erro sem vazar dados do pedido"; `e2e/account-wallets.spec.ts` "22. isolamento"; `e2e/account-favorites.spec.ts` "10d. isolamento" |
| E5 | Eventos simulados diretamente na UI | ATENDE | O único import de `src/mocks` fora de mocks é o import dinâmico em `src/main.tsx:34`. Nenhum dado fictício fora de `src/mocks` (grep por hashes `0x`, `example.com`, lorem). `setQueryData` aparece só em mutations otimistas (`useFavorites`, `useCartItemMutations`, `useCoupon`, `useProfile`, `useAddToCart`, `useWallets`, `pendingOrder`) e na aplicação de eventos já recebidos pelo socket (`src/features/realtime/cacheSync.ts`). Os eventos nascem no store do mock (`src/mocks/realtime/socket.ts:313-315`) e chegam pelo `socket.io-client`. `mockControl.inspectQueryCache` (`src/mocks/control.ts:43-56`) só lê o cache. Os helpers de teste emitem pelo socket (`e2e/fixtures.ts`: "Tempo real: passa pelo socket.io-client do app, nunca mexe no cache") |
| E6 | Testes E2E executáveis | ATENDE | `pnpm test:e2e` (`package.json`), relatório HTML (`reporter: [['html'...]]`), `trace: 'retain-on-failure'`, projetos `desktop` (1440) e `mobile` (390, `isMobile`) em Chromium (`playwright.config.ts:19-55`). O webServer sobe o Vite com `VITE_ENABLE_MOCKS=true`. Último resultado: 340 passaram e 4 foram pulados, como esperado |

---

## 3. Tabela completa de requisitos

Legenda: ✅ ATENDE · 🟡 PARCIAL · ❌ NÃO ATENDE · ❔ NÃO VERIFICÁVEL. Os nomes de testes citam o arquivo e o título do teste.

### Seção 1 — Escopo

| # | Requisito | Status | Evidência / o que falta |
|---|---|---|---|
| 1.1 | Descoberta, compra e conta, desktop e mobile | ✅ | Rotas em `src/routes/*`; os projetos desktop e mobile rodam todos os specs; capturas em 1440 e 390 sem overflow (`scrollWidth - clientWidth = 0` nas 10 telas) |
| 1.2 | APIs, autenticação, carteiras e pagamentos com dados simulados | ✅ | `src/mocks/handlers/*` (auth, cart, quote, orders, wallets, profile...) |
| 1.3 | Sem blockchain real, extensões ou gateways | ✅ | A conexão de carteira é `POST /wallets/:id/connect` simulado (`checkoutApi.ts:21-28`); links de explorer simulados (`src/mocks/db/util.ts:60-61`) |
| 1.4 | Estados não desenhados seguem o padrão visual | 🟡 | Vazio, erro, pendente, recusado e 404 seguem os tokens (capturas `d-404`, `m-order`). **Os skeletons não aparecem** (ver 8.6) |

### Seção 2 — Stack obrigatória

| # | Tecnologia | Status | Evidência |
|---|---|---|---|
| 2.1 | React | ✅ | `src/main.tsx`, react 19.3 |
| 2.2 | TypeScript | ✅ | `tsconfig.*.json`; `pnpm typecheck` exit 0 |
| 2.3 | TanStack Router | ✅ | `src/router.ts`, `src/routes/*`, `routeTree.gen.ts` |
| 2.4 | TanStack Query | ✅ | `src/lib/queryClient.ts`, `src/lib/queryKeys.ts` |
| 2.5 | Axios | ✅ | `src/lib/api.ts`; nenhuma chamada REST fora dele |
| 2.6 | REST APIs | ✅ | `docs/API.md`; handlers em `src/mocks/handlers` |
| 2.7 | Socket.IO | ✅ | `socket.io-client` em `src/features/realtime/socket.ts`; servidor simulado com `@mswjs/socket.io-binding` |
| 2.8 | Tailwind CSS | ✅ | `@tailwindcss/vite`, `src/index.css` |
| 2.9 | shadcn/ui | ✅ | `components.json`, `src/components/ui/*` adaptados aos tokens |
| 2.10 | MSW | ✅ | `src/mocks/browser.ts` |
| 2.11 | Playwright | ✅ | `playwright.config.ts`, `e2e/*.spec.ts` |
| 2.12 | Lighthouse | ✅ | `lighthouse/run.mjs`, relatórios em `lighthouse/reports/` |
| 2.13 | Participação efetiva | ✅ | Ver E1 |

### Seção 3 — Telas e fluxos

| # | Requisito | Status | Evidência / o que falta |
|---|---|---|---|
| 3.1 | Início: destaques | ✅ | `src/features/home/HomeHero.tsx`, `FeaturedBox.tsx`; captura `d-home` |
| 3.2 | Início: catálogo | ✅ | `CatalogSection.tsx`; `e2e/smoke.spec.ts` "a página inicial abre e mostra o catálogo com 9 NFTs" |
| 3.3 | Início: busca | ✅ | `e2e/catalog.spec.ts` "1. busca filtra a lista, entra na URL e limpar restaura os 9 itens" |
| 3.4 | Início: filtros | ✅ | `e2e/catalog.spec.ts` "2. filtros combinados (coleção + rede + preço)..." |
| 3.5 | Início: ordenação | ✅ | `e2e/catalog.spec.ts` "3. ordenação por preço crescente e decrescente" |
| 3.6 | Início: navegação para o NFT | ✅ | `e2e/catalog.spec.ts` "10. detalhe: acesso direto, NFT inexistente e clique no card" |
| 3.7 | Detalhe: galeria | ✅ | `src/features/catalog/detail/Gallery.tsx`; `e2e/a11y.spec.ts` "3b. Dialog de zoom da imagem no detalhe" |
| 3.8 | Detalhe: informações | ✅ | `NftDetail.tsx`, `DetailTabs.tsx`; captura `d-detail` |
| 3.9 | Detalhe: edição | ✅ | `EditionPicker.tsx`; `e2e/catalog.spec.ts` "11. edição esgotada desabilitada e limite de quantidade no estoque" |
| 3.10 | Detalhe: quantidade | ✅ | `QuantityStepper.tsx`; mesmo teste 11 |
| 3.11 | Detalhe: favoritos | ✅ | `e2e/account-favorites.spec.ts` "10b. detalhe: favoritar e desfavoritar muda na hora e persiste após F5" |
| 3.12 | Detalhe: compra | ✅ | `usePurchase.ts`; `e2e/cart.spec.ts` "2. adicionar pelo detalhe (COMPRAR) e pelo card..." |
| 3.13 | Carrinho: edição de quantidades | ✅ | `e2e/cart.spec.ts` "3. quantidade: stepper, mínimo 1, limite do estoque..." |
| 3.14 | Carrinho: remoção | ✅ | `e2e/cart.spec.ts` "4. remover: lixeira, foco válido, resumo e badge..." |
| 3.15 | Carrinho: cupom | ✅ | `e2e/cart.spec.ts` "5. cupom válido: desconto, total pela cotação e remoção; inválido e expirado..." |
| 3.16 | Carrinho: resumo de valores | ✅ | `e2e/cart.spec.ts` "1. valores do design: ... subtotal 26.83, taxa 0.016, total 26.846 e igual à cotação da API" |
| 3.17 | Pagamento: dados do colecionador | ✅ | `CollectorForm.tsx`; `e2e/purchase.spec.ts` "11. validação: campos vazios, e-mail e endereço inválidos..." |
| 3.18 | Pagamento: seleção de carteira e rede | ✅ | `WalletSection.tsx`; captura `d-checkout` |
| 3.19 | Pagamento: revisão e envio | ✅ | `ReviewDialog.tsx`; `e2e/purchase.spec.ts` "12. revisão: 'Voltar e editar'..." e "10. compra completa..." |
| 3.20 | Confirmação: resultado, transação, itens, taxas, total | ✅ | `ReceiptView.tsx`; `e2e/purchase.spec.ts` "16. ... recibo com 2.38, 8.34, 16.11 e taxa 0.016"; captura `m-order` |
| 3.21 | Login: autenticação, validação, retorno ao fluxo | ✅ | `e2e/account-session.spec.ts` "4. login: senha errada avisa com role=alert; certo volta ao redirect..." |
| 3.22 | Cadastro: criação, validação, conflito | ✅ | `e2e/account-session.spec.ts` "1. cadastro...", "2. validação do cadastro...", "3. conflito de cadastro..." |
| 3.23 | Perfil: dados, avatar, senha | ✅ | `e2e/account-profile.spec.ts` "13", "15a/b/c", "16. senha: ..." |
| 3.24 | Carteiras: principal e secundária | ✅ | `e2e/account-wallets.spec.ts` "18. usuário novo: ... cadastra as duas e persiste após F5" |
| 3.25 | Frames desktop e mobile implementados | 🟡 | Desktop muito próximo do Figma. No mobile há desvios do frame `home-mobile.png` (ver 8.1). Os desvios não estão registrados em ARCHITECTURE.md |
| 3.26 | Perfil, carteiras e confirmação em mobile | ✅ | Capturas `m-profile`, `m-wallets`, `m-order` (390 px, sem overflow); `e2e/responsive.spec.ts` "10. 390 px" (inclui /profile e /wallets); `e2e/purchase.spec.ts` "17. mobile: o fluxo completo..." |
| 3.27 | Fora do escopo sem aparentar sucesso | ✅ | `src/lib/unavailable.ts` ("Indisponível nesta versão"), usado em Header, Footer, MobileNav, SocialButtons, LoginForm, AccountNav e outros; lista em `docs/design/screens.md:47-53` |
| 3.28 | Links externos coerentes | ✅ | "Ver no Etherscan" abre a referência simulada com o aviso "Referência simulada, não é uma transação real" (captura `m-order`) |
| **Catálogo e detalhe** | | | |
| 3.29 | Busca, filtros, ordenação e paginação na URL | ✅ | `src/features/catalog/searchParams.ts:23-32`; `src/routes/index.tsx:9-13` |
| 3.30 | Sobrevivem a refresh e histórico | ✅ | `e2e/catalog.spec.ts` "5. filtros + página 2 sobrevivem ao F5 e ao voltar/avançar no histórico" |
| 3.31 | Filtros combináveis | ✅ | `e2e/catalog.spec.ts` "2. filtros combinados..." |
| 3.32 | Mudança de filtro reinicia a paginação | ✅ | `e2e/catalog.spec.ts` "2b. mudar ${label} reinicia a página para 1" |
| 3.33 | Consultas refletem os parâmetros enviados | ✅ | `toListQuery` → `params` do Axios (`useCatalogQuery.ts:8-18`, `nftApi.ts:7-8`); teste 2 compara com a API |
| 3.34 | Resultado vazio | ✅ | `e2e/catalog.spec.ts` "6. estado vazio com 'Limpar filtros' e restauração da lista" |
| 3.35 | Falhas | ✅ | `e2e/catalog.spec.ts` "7. falha do servidor mostra o aviso e 'Tentar de novo' recupera sem recarregar" |
| 3.36 | Respostas fora de ordem | ✅ | Chave por parâmetros + `signal` (`useCatalogQuery.ts:30-32`); `e2e/catalog.spec.ts` "8. respostas fora de ordem: a tela mostra só o último termo" |
| 3.37 | Detalhe: acesso direto | ✅ | Teste 10 do catálogo; deploy: `/nft/nft_001` → h1 "Emerald Ape #042" |
| 3.38 | Detalhe: NFT inexistente | ✅ | Teste 10: `/nft/inexistente` → "NFT não encontrado" |
| 3.39 | Edição indisponível | ✅ | Teste 11 do catálogo; `e2e/a11y.spec.ts` "7a. edição esgotada tem o texto 'Esgotada'..." |
| 3.40 | Limite de quantidade | ✅ | Teste 11 do catálogo; `e2e/cart.spec.ts` "3. ... limite do estoque com aviso" |
| 3.41 | Favoritos persistem para o autenticado | ✅ | `e2e/account-favorites.spec.ts` "10a", "10b", "10c" |
| **Carrinho** | | | |
| 3.42 | Adicionar, alterar e remover respeitando NFT e edição | ✅ | `e2e/cart.spec.ts` "2", "3", "4" |
| 3.43 | Mantém após refresh | ✅ | `e2e/cart.spec.ts` "6. persistência: F5 e fechar/abrir a página mantêm itens, quantidades e cupom" |
| 3.44 | Preserva itens do visitante ao autenticar | ✅ | Mescla em `src/mocks/handlers/auth.ts:70`; `e2e/cart.spec.ts` "7. visitante: itens sobrevivem ao F5, são mesclados ao entrar..." |
| 3.45 | Aplicar e remover cupom; inválido e expirado | ✅ | `e2e/cart.spec.ts` "5" |
| 3.46 | Subtotal, desconto, taxa e total iguais à API | ✅ | `e2e/cart.spec.ts` "1"; contrato `src/contracts/quote.ts:64-67` |
| 3.47 | Reflete preço e disponibilidade com o carrinho aberto | ✅ | `useCartRealtime.ts`; `e2e/realtime.spec.ts` "9a" e "9b" |
| 3.48 | ETH como string decimal, com precisão | ✅ | `EthString` (`src/contracts/common.ts:9`) em todos os contratos; decimal.js em `src/lib/eth.ts` e nas features; nenhum `parseFloat` ou aritmética nativa em ETH (grep). Os únicos `toNumber()` estão em `src/features/catalog/list/price.ts:14` (passos inteiros do slider, centésimos) e não chegam à API. `toFixed(1)` só na nota de avaliação |
| 3.49 | Quantidades inteiras | ✅ | `Quantity = z.number().int().positive()` (`common.ts:15`) |
| 3.50 | Cotação da API como referência para finalizar | ✅ | Pedido exige `quoteId` e o servidor confere itens e cupom (`src/mocks/handlers/orders.ts:90-96`) |
| **Pagamento e confirmação** | | | |
| 3.51 | Valida campos do layout | ✅ | `src/features/checkout/schema.ts`; `e2e/purchase.spec.ts` "11"; `e2e/a11y.spec.ts` "4c" |
| 3.52 | Revisão antes do envio | ✅ | `e2e/purchase.spec.ts` "12"; `e2e/a11y.spec.ts` "3c. Dialog de revisão do checkout" |
| 3.53 | Carteiras cadastradas e seleção de rede | ✅ | `e2e/account-wallets.spec.ts` "21. a carteira nova aparece na lista de carteiras do /checkout" |
| 3.54 | Conexão, recusa e desconexão simuladas | ✅ | `useWalletConnection.ts`; cenário `wallet-rejected` (`src/mocks/scenarios/definitions.ts:226-236`); captura `d-checkout` ("Carteira desconectada. Conecte para confirmar") |
| 3.55 | Revalida preço, disponibilidade, cupom e taxa | ✅ | `useStaleQuoteGuard.ts`, `quoteChanges.ts`; 409 `price_changed`/`sold_out` (`orders.ts:121-143`); `e2e/failures.spec.ts` "5" e "6" |
| 3.56 | Mudanças exigem nova confirmação | ✅ | `e2e/failures.spec.ts` "5. ... só a nova confirmação envia (com chave nova)"; `e2e/realtime.spec.ts` "11a", "11b" |
| 3.57 | Sem duplicata em cliques repetidos | ✅ | `e2e/failures.spec.ts` "2. clique repetido (${variant}) em 'Enviar pedido': um único POST e um único pedido novo" |
| 3.58 | Sem duplicata em reenvio após timeout | ✅ | `idempotency.ts`; `e2e/failures.spec.ts` "3. timeout após criar o pedido: ... reenvio com a mesma chave recupera o mesmo pedido" |
| 3.59 | Pendente, confirmado e recusado | ✅ | `PendingView`, `ReceiptView`, `RejectedView`; `e2e/realtime.spec.ts` "14a", "14b" |
| 3.60 | Recuperação após refresh ou reconexão | ✅ | `e2e/realtime.spec.ts` "16. pendente com queda: ... recuperado ao ${recovery}, sem outra compra" e "17. F5 no pendente..." |
| 3.61 | Confirmação só para pedido confirmado | ✅ | Ver E3 |
| 3.62 | Preserva itens em falhas | ✅ | `e2e/failures.spec.ts` "1", "7a", "7b" ("nada perdido") |
| 3.63 | Remove só os itens e quantidades comprados | ✅ | `settleOrder.ts`; `e2e/purchase.spec.ts` "13a. pós-compra: o carrinho perde só os itens e quantidades comprados..." |
| 3.64 | Recibo é snapshot | ✅ | `ReceiptView` só lê `Order` (sem `useNft`); `e2e/purchase.spec.ts` "14. snapshot: mudar o preço do NFT depois da compra não altera o recibo (nem com F5)" |
| 3.65 | Referências e links de explorer simulados | ✅ | `src/mocks/db/util.ts:60-61`; aviso na tela do recibo |
| **Conta e sessão** | | | |
| 3.66 | Cadastro, login, logout e sessão integrados à API | ✅ | `src/features/auth/session.ts`, `authApi.ts`; testes 1, 4 e 8 de `account-session.spec.ts` |
| 3.67 | Checkout, perfil, carteiras, favoritos e pedidos exigem autenticação | ✅ | `src/routes/_authenticated/*` + `requireSession`; `e2e/account-session.spec.ts` "5. rota privada ${path} sem sessão leva ao login com redirect" |
| 3.68 | Sessão recuperável após refresh | ✅ | `sessionStore.restore()` (`session.ts:88-111`); teste 1 ("sobrevive ao F5") |
| 3.69 | Expiração durante a navegação, preservando contexto | ✅ | `src/router.ts:31-36` (redirect + `reason=expired`); `e2e/account-session.spec.ts` "6" e "6b" |
| 3.70 | Expiração durante o checkout, preservando contexto | ✅ | `e2e/account-session.spec.ts` "7. expiração no checkout: volta ao /checkout com rascunho e carrinho preservados, sem pedido duplicado"; `e2e/failures.spec.ts` "8" |
| 3.71 | Logout e troca limpam cache e subscriptions | ✅ | Ver E4 |
| 3.72 | Valida cadastro, perfil, senha e carteiras, inclusive erros da API | ✅ | `applyApiError.ts`, `serverErrors.ts`; `e2e/account-profile.spec.ts` "14. conflito no perfil..."; `account-wallets.spec.ts` "19"; `account-session.spec.ts` "3"; cenário `client-errors` |
| 3.73 | Alterações persistem após refresh | ✅ | `e2e/account-profile.spec.ts` "13" e "15b"; `account-wallets.spec.ts` "18" |
| 3.74 | Credenciais fictícias | ✅ | `docs/API.md:184-189` (ana@example.com / ana12345, bruno@example.com / bruno12345) |
| 3.75 | Senhas nunca em claro | ✅ | PBKDF2-SHA256 com salt (`src/mocks/db/auth.ts:23-50`); o seed só tem hashes (`seed.ts:345-359`); `e2e/account-profile.spec.ts` "16. ... senhas não vazam" |

### Seção 4 — Integração e estado

| # | Requisito | Status | Evidência / o que falta |
|---|---|---|---|
| 4.1 | Router nas rotas, search params e proteção | ✅ | Ver E1 |
| 4.2 | Query em consultas, mutations e sincronização | ✅ | Ver E1; `cacheSync.ts` |
| 4.3 | REST pelo Axios | ✅ | Ver E1 |
| 4.4 | Contratos tipados transporte → estado → UI | ✅ | `src/contracts/*` (Zod), `api.get(Schema, ...)` infere o tipo; resposta fora do contrato vira `ApiRequestError kind:'contract'` (`api.ts:111-123`) |
| 4.5 | Estado de carregamento | 🟡 | O estado existe e as dimensões ficam estáveis (`e2e/catalog.spec.ts` "9", `e2e/cart.spec.ts` "8b", `e2e/responsive.spec.ts` "13a"), mas o skeleton **não é pintado** (ver 8.6) |
| 4.6 | Vazio | ✅ | Catálogo (teste 6), carrinho (`cart.spec.ts` "4": "o último item mostra o carrinho vazio"), cenário `empty` |
| 4.7 | Erro | ✅ | `CatalogSection.tsx:53-64`, `NftDetailError`, `QueryError`; `responsive.spec.ts` "13b" |
| 4.8 | Sucesso | ✅ | Toasts em região aria-live (`a11y.spec.ts` "8a", "8b") |
| 4.9 | Atualização em segundo plano | ✅ | `keepPreviousData` + `opacity-60` (`CatalogSection.tsx:37, 90`) |
| 4.10 | Invalidação coerente após mutations e eventos | ✅ | `session.ts:51,60`; `cacheSync.ts:88-92, 126, 150-157` |
| 4.11 | Cancelamento ou descarte de respostas obsoletas | ✅ | `signal` em todas as `queryFn`; o interceptor repassa o cancelamento (`api.ts:55-56`); tracker de versão nos eventos |
| 4.12 | Isolamento por usuário e por parâmetros | ✅ | `queryKeys.ts` (userId nas chaves privadas; o objeto de consulta inteiro na chave da lista) |
| 4.13 | Recuperação sem duplicar operações | ✅ | Mutations com `retry: false` (`queryClient.ts:28-30`); Idempotency-Key; `e2e/failures.spec.ts` "7a", "7b" ("um único pedido") |
| 4.14 | Rotas inexistentes | 🟡 | `defaultNotFoundComponent` (`router.ts:18`) e `notFoundComponent` (`__root.tsx:16`); verificado no navegador: `/rota-inexistente` mostra "Página não encontrada" + "Voltar ao início". **Falta**: o título da aba fica só "Kurio" e nenhum teste E2E cobre uma rota desconhecida |
| 4.15 | Acesso direto a qualquer tela | ✅ | `vercel.json` (rewrite para `/index.html`); deploy: as 7 rotas testadas respondem 200 `text/html` |
| 4.16 | Uma atualização otimista com rollback | ✅ | Favoritos: `useFavorites.ts:49-60` (`onMutate`/`onError`); também carrinho e perfil. `e2e/account-favorites.spec.ts` "12a. falha ao favoritar: otimista, rollback e aviso acessível; depois recupera" |
| 4.17 | Política de cache, retries e sincronização **documentada** | 🟡 | Só em comentário de código (`src/lib/queryClient.ts:4-15`, `useCatalogQuery.ts:20-27`, `useOrderStatus.ts:72-84`) e em parte de `docs/REALTIME.md:133`. Não há seção em ARCHITECTURE.md nem no README. **Risco**: o avaliador procura em documentação. **Correção**: seção "Cache e sincronização" em ARCHITECTURE.md (30 min) |

### Seção 5 — Contratos REST

| # | Requisito | Status | Evidência |
|---|---|---|---|
| 5.1 | Contratos definidos e documentados | ✅ | `src/contracts/*` + `docs/API.md` (209 linhas, uma tabela por recurso) |
| 5.2 | Sessão: cadastro, login, consulta, logout, expiração | ✅ | `docs/API.md:26-37`; `src/mocks/handlers/auth.ts` |
| 5.3 | NFTs: listagem com busca, filtros, ordenação, paginação + detalhe | ✅ | `docs/API.md:39-60`; `handlers/nfts.ts` |
| 5.4 | Favoritos: consulta, inclusão, remoção | ✅ | `docs/API.md:62-70`; `handlers/favorites.ts` |
| 5.5 | Carrinho: consulta, inclusão, alteração, remoção | ✅ | `docs/API.md:72-86`; `handlers/cart.ts` |
| 5.6 | Cotação: cupom, disponibilidade, descontos, taxas, total | ✅ | `docs/API.md:88-103`; `handlers/quote.ts` |
| 5.7 | Pedidos: criação idempotente, estado e recibo | ✅ | `docs/API.md:105-128`; `handlers/orders.ts` |
| 5.8 | Perfil: consulta, dados e avatar, senha | ✅ | `docs/API.md:130-147`; `handlers/profile.ts:118-126` |
| 5.9 | Carteiras: consulta, cadastro, atualização | ✅ | `docs/API.md:149-174`; `handlers/wallets.ts` |
| 5.10 | Erro de validação | ✅ | `validation` 400/422 com `fieldErrors` (`docs/API.md:14-24`) |
| 5.11 | Sessão inválida | ✅ | 401 `unauthorized` |
| 5.12 | Falta de permissão | ✅ | 403 `forbidden` (pedido ou cotação de outra sessão; `client-errors`) |
| 5.13 | Recurso inexistente | ✅ | 404 `not_found` |
| 5.14 | Conflito de disponibilidade | ✅ | 409 `OrderConflict` (`price_changed`/`sold_out`), `src/contracts/order.ts` |
| 5.15 | Falha transitória | ✅ | 5xx `transient`, `Retry-After` (`definitions.ts:92-108`) |
| 5.16 | Mutations de pedido aceitam chave de idempotência | ✅ | Cabeçalho `Idempotency-Key` + corpo (`checkoutApi.ts:34-38`) |
| 5.17 | Mesma tentativa recupera o mesmo pedido | ✅ | `orders.ts:219` (`Idempotent-Replayed`); `e2e/failures.spec.ts` "4. idempotência na API: mesma chave e corpo devolvem o mesmo pedido..." |
| 5.18 | Chave reutilizada com outro conteúdo → conflito | ✅ | `orders.ts:76-77` (409); mesmo teste 4 ("corpo diferente dá 409") |

### Seção 6 — Mocking com MSW

| # | Requisito | Status | Evidência / o que falta |
|---|---|---|---|
| 6.1 | Mocks na camada de rede | ✅ | Service worker (`setupWorker`) + `ws.link` |
| 6.2 | Contratos e cenários reutilizados entre dev, demo e testes | ✅ | Os handlers importam `@/contracts`; o mesmo `window.__mocks` em dev, no build e no Playwright |
| 6.3 | Sem respostas fictícias em componentes, hooks e Axios | ✅ | Ver E5 |
| 6.4 | Estado consistente entre catálogo, favoritos, carrinho, perfil, carteiras e pedidos | ✅ | Store único `src/mocks/db/store.ts` com `transact`; o pedido reserva estoque e emite `nft.updated` |
| 6.5 | Persistência local para refresh | ✅ | `localStorage` `nft-marketplace:mocks:db` (`docs/API.md:179`) |
| 6.6 | Reset restaura integralmente um cenário conhecido | ✅ | `mockControl.reset` (seed, configurações e cenário default, além do realtime: `socket.ts:342-347`); usado antes de cada teste (`e2e/fixtures.ts:11-23`) |
| 6.7 | Lentidão | ✅ | Cenário `slow` |
| 6.8 | Latência variável | ✅ | Cenário `jitter` (seedado, sem `Math.random`) |
| 6.9 | Timeouts | ✅ | `order-timeout` (`delay('infinite')`); `failNext({ afterHandler })` |
| 6.10 | Indisponibilidade de conexão | ✅ | `offline` (`HttpResponse.error()`) |
| 6.11 | Respostas HTTP de erro | ✅ | `server-error`, `client-errors` |
| 6.12 | Configuráveis e reproduzíveis | ✅ | `?scenario=` / `?seed=` / `setScenario(nome, opções)`; `docs/SCENARIOS.md` |
| 6.13 | Fixtures com variedade para filtros e paginação | ✅ | 36 NFTs, 9 coleções, 3 redes, 4 edições, preços de 0.02 a 12.30 (`docs/API.md:193`) |
| 6.14 | Pelo menos dois usuários | ✅ | Ana e Bruno (`seed.ts:342, 355`) |
| 6.15 | Cenário: sucesso | ✅ | `default` |
| 6.16 | Cenário: resultado vazio | ✅ | `empty` |
| 6.17 | Cenário: latência variável | ✅ | `jitter` |
| 6.18 | Cenário: respostas fora de ordem | ✅ | `jitter`; `e2e/catalog.spec.ts` "8" |
| 6.19 | Cenário: falha de conexão | ✅ | `offline`; `e2e/failures.spec.ts` "7b" |
| 6.20 | Cenário: HTTP 4xx | ✅ | `client-errors` |
| 6.21 | Cenário: HTTP 5xx | ✅ | `server-error`; `e2e/failures.spec.ts` "7a" |
| 6.22 | Cenário: sessão expirada | ✅ | `session-expired` (navegação e depois checkout) |
| 6.23 | Cenário: acesso não autorizado | ✅ | `client-errors` (403); pedido de outro usuário (`purchase.spec.ts` "15") |
| 6.24 | Cenário: conflito de cadastro | ✅ | `register-conflict` |
| 6.25 | Cenário: validação de formulário | ✅ | `client-errors` (400 com `fieldErrors` em cada campo) |
| 6.26 | Cenário: cupom inválido | ✅ | `coupon-invalid` |
| 6.27 | Cenário: cupom expirado | ✅ | `coupon-expired` |
| 6.28 | Cenário: preço alterado durante a compra | ✅ | `price-changed` |
| 6.29 | Cenário: edição esgotada durante a compra | ✅ | `sold-out` |
| 6.30 | Cenário: timeout após criar pedido, com recuperação por idempotência | ✅ | `order-timeout`; `e2e/failures.spec.ts` "3" |
| 6.31 | Cenário: pagamento confirmado | ✅ | `payment-confirmed` |
| 6.32 | Cenário: pagamento recusado | ✅ | `payment-rejected`; `e2e/failures.spec.ts` "1" |
| 6.33 | Eventos com MSW e protocolo Socket.IO (`@mswjs/socket.io-binding`) | ✅ | `src/mocks/realtime/socket.ts` (Engine.IO v4, handshake com `auth.token`, salas) |
| 6.34 | Transporte e limitações documentados | ✅ | `docs/REALTIME.md` "Transporte" e "Limitações do ambiente de mocks" (linhas 11-33 e 129-141) |
| 6.35 | Cenários exercitam o socket.io-client | ✅ | `emitNftUpdate`, `emitDuplicate`, `emitStale`, `disconnectSockets` passam pelo servidor simulado; os testes conferem `listSockets()`/`socketStats()` |
| 6.36 | Ativação por configuração | 🟡 | `VITE_ENABLE_MOCKS` (`main.tsx:26-41`). **Falta**: a flag de dev só existe em `.env.local`, que não é versionado (`.gitignore`: `*.local`). Num checkout limpo, `pnpm dev` sobe **sem** mocks e o README não manda copiar `.env.example`. **Correção**: versionar `.env.development` com `VITE_ENABLE_MOCKS=true` (5 min) |
| 6.37 | Disponível no build de demonstração | ✅ | `.env.production` versionado; deploy: `window.__mocks` presente, 17 cenários, socket `connected` |
| 6.38 | Mudança nos dados reflete em REST e eventos | ✅ | `updateNft` → `subscribe` → `publish` (`socket.ts:313-315`); no deploy, `setNftPrice('nft_001','2.50')` mudou o card de 1.19 para 2.50 ETH sem recarregar |

### Seção 7 — Tempo real

| # | Requisito | Status | Evidência |
|---|---|---|---|
| 7.1 | `nft.updated` atualiza o catálogo | ✅ | `cacheSync.ts:83`; `e2e/realtime.spec.ts` "10a. catálogo: o evento atualiza o preço no card, sem refazer a lista" |
| 7.2 | `nft.updated` atualiza o detalhe | ✅ | `cacheSync.ts:82`; `realtime.spec.ts` "10b" |
| 7.3 | `nft.updated` atualiza o carrinho | ✅ | Cotação invalidada (`cacheSync.ts:88-92`); `realtime.spec.ts` "9a", "9b" |
| 7.4 | `order.updated` atualiza o estado e mostra confirmação ou recusa | ✅ | `cacheSync.ts:107-139`; `realtime.spec.ts` "14a", "14b" |
| 7.5 | Identidade estável, recurso afetado e versão | ✅ | `src/contracts/events.ts` (`id`, `resource {type,id}`, `version`); `docs/REALTIME.md:49-92` |
| 7.6 | Tolera duplicatas | ✅ | `VersionTracker` (`versions.ts:26-31`); `realtime.spec.ts` "12. duplicado e antigo não repetem aviso nem regridem..." |
| 7.7 | Tolera eventos antigos sem regredir | ✅ | Comparação com a versão do cache (`versions.ts:30`, `cacheSync.ts:56, 114-115`); testes "12" e "15. terminal: ..." |
| 7.8 | Não reaplica efeitos | ✅ | Barramento só com eventos aceitos (`bus.ts`); `settled` ref (`useOrderStatus.ts:126-133`); teste "15" |
| 7.9 | Reconcilia com REST após reconexão | ✅ | `reconcileWithApi` (`cacheSync.ts:150-157`); `realtime.spec.ts` "13. reconexão: evento perdido na queda é recuperado pela API..." |
| 7.10 | Eventos da sessão anterior não atualizam outro usuário | ✅ | `sameSession()` + `event.userId` (`useRealtimeSync.ts:49, 78`); `realtime.spec.ts` "18b" |
| 7.11 | Listeners e subscriptions liberados | ✅ | `closeSocket`, limpeza do efeito; `realtime.spec.ts` "19a. logout: o socket da sessão fica sem listeners..." e "19b. navegar várias vezes ... não aumenta os listeners" |
| 7.12 | Cenário: NFT no carrinho, preço/disponibilidade muda, UI informa e atualiza o resumo | ✅ | `realtime.spec.ts` "9a", "9b"; `a11y.spec.ts` "7b" |
| 7.13 | Checkout impede confirmação com cotação desatualizada | ✅ | `useStaleQuoteGuard.ts`; `realtime.spec.ts` "11a. checkout com a revisão aberta: o evento bloqueia 'Enviar pedido'..." e "11b" |
| 7.14 | Queda com pedido pendente: recupera sem nova compra | ✅ | Polling sem socket (`useOrderStatus.ts:96-100`) + releitura ao conectar; `realtime.spec.ts` "16" e "17" |
| 7.15 | Confirmado e recusado são terminais | ✅ | `cacheSync.ts:115`; `realtime.spec.ts` "15"; `purchase.spec.ts` "13b" |

### Seção 8 — Interface, responsividade e acessibilidade

| # | Requisito | Status | Evidência / o que falta |
|---|---|---|---|
| 8.1 | Tipografia, cores, espaçamentos, hierarquia, imagens e composição do Figma | 🟡 | **Desktop (1440)**: início, checkout e 404 comparados com `home-desktop.png` e `checkout-desktop.png`; composição, cores (#140D0A, #211512, #D08B4C), tipografia mono e grade 3×3 batem. Desvios vistos: (a) no checkout, Violet Nomad #314 usa a imagem do Emerald Ape, enquanto o Figma usa a do macaco de chapéu (Sage); (b) os ícones das redes sociais no rodapé viraram texto ("f", "ig", "x", "in", "yt"); (c) a coluna "Coleções" do rodapé não tem "Utilidade"; (d) o texto do rodapé fica menor que no frame; (e) os filtros têm checkboxes, que o Figma não mostra (decisão razoável de a11y, mas não documentada). **Mobile (390)** contra `home-mobile.png`: (f) a busca "Explorar coleções" fica abaixo do hero (no Figma fica acima); (g) o grid é regular, sem o deslocamento em zigue-zague das colunas; (h) os cards mostram 3 ações sempre visíveis (carrinho, favorito, ver), e o Figma só o coração; (i) o hero não tem a miniatura sobreposta; (j) há um seletor de ordenação extra no topo; (k) nome longo truncado ("Golden Frequency #0..."). Nenhum desses desvios está em ARCHITECTURE.md. **Risco**: de −2 a −4 no critério de 20 pts |
| 8.2 | shadcn/ui adaptado à identidade | ✅ | `src/components/ui/*` com tokens (`src/index.css:58-70`) |
| 8.3 | Desktop, tablet e mobile em todas as telas | ✅ | `e2e/responsive.spec.ts` "10. 390 px", "10. 768 px", "10. 1440 px" (9 telas cada) e "12. tablet (768 px)" (Sheet de filtros, checkout, carrinho). Observação: o projeto `tablet` de `playwright.config.ts:47-51` aponta para `layout.spec.ts`, que **não existe** (configuração morta, sem impacto funcional) |
| 8.4 | Atenção a filtros, navegação, formulários, carrinho e checkout | ✅ | Mesmos testes; Sheet de filtros (`a11y.spec.ts` "3a") |
| 8.5 | Larguras 390, 768 e 1440 | ✅ | `responsive.spec.ts:213-218`; capturas manuais sem overflow |
| 8.6 | Skeletons com shimmer no catálogo, detalhe e resumo do carrinho | ❌ | Os componentes existem (`NftCardSkeleton`, `NftDetailSkeleton`, `CartSummary`...), mas **não aparecem**. A utility `shimmer` de `shadcn/tailwind.css` (`node_modules/shadcn/dist/tailwind.css:547+`, importada em `src/index.css:3`) se funde com a classe `.shimmer` do projeto (`src/index.css:113-118`) e aplica `background-clip: text`. Medido no `pnpm preview`, cenário `slow`: `getComputedStyle(bone).backgroundClip === "text"`; a grade do catálogo (840×1000 px) e as facetas aparecem vazias na captura. Os testes passam porque `toBeVisible` só olha a caixa. **Risco**: alto na fidelidade (estados de carregamento) e em 4.5. **Correção**: renomear a classe (p. ex. `.skeleton-bone`) nos 9 arquivos + `index.css`, ou forçar `background-clip: border-box; color: inherit` em `.shimmer`; acrescentar no teste a11y 9a/9c uma checagem de `backgroundClip !== 'text'` (20 min) |
| 8.7 | Dimensões preservadas (sem CLS) | ✅ | `e2e/catalog.spec.ts` "9" (tolerância de 8 px); `cart.spec.ts` "8b"; `responsive.spec.ts` "13a"; CLS do detalhe desktop = 0 (`lighthouse/RESULTADOS.md`) |
| 8.8 | Respeita reduced motion | ✅ | `src/index.css:120-122`; `a11y.spec.ts` "9a", "9b", "9c" |
| 8.9 | Contraste dos skeletons | 🟡 | Mesmo depois da correção de 8.6: `--border` #3D2A1D sobre #140D0A tem contraste ≈ 1,4:1 e sobre `surface` #211512 ≈ 1,2:1. Bastante discreto (WCAG não exige contraste para placeholder decorativo, mas o "osso" deve ser perceptível). Sugestão: usar `surface-strong` #3A2314 com realce mais forte no gradiente |
| 8.10 | Navegação por teclado e foco visível | ✅ | `a11y.spec.ts` "1a. o primeiro Tab leva ao link 'Ir para o conteúdo'..." e "1b. Tab percorre ... todos com foco visível" |
| 8.11 | Foco em diálogos e drawers | ✅ | `a11y.spec.ts` "2", "3a", "3b", "3c", "3d"; `account-profile.spec.ts` "17" |
| 8.12 | Semântica, labels e erros associados | ✅ | `a11y.spec.ts` "4a" a "4e", "6a", "6b"; `a11y-helpers.ts:251` (`aria-describedby`) |
| 8.13 | Alternativas textuais | ✅ | `a11y.spec.ts` "5. imagens: alt em todas, significativo nas de NFT..." |
| 8.14 | Contraste legível | ✅ | Lighthouse Accessibility 100 nas 4 combinações (`lighthouse/RESULTADOS.md`) |
| 8.15 | Estados não dependentes só de cor | ✅ | `a11y.spec.ts` "7a", "7b", "7c" |
| 8.16 | Feedback acessível para mutations e tempo real | ✅ | `a11y.spec.ts` "8a", "8b", "8c"; anúncios `role=status` (`OrderPage.tsx:45-47`, `useNftChangeAnnouncer.ts`) |
| 8.17 | Sem overflow horizontal; sem perda com zoom | ✅ | `responsive.spec.ts` "11. 320 px (reflow, zoom de 400% em 1280)"; capturas com `overflowX = 0` |
| 8.18 | Assets do arquivo usados | ✅ | `public/assets/{Eape,Sape,Nape,Gape,tyou}.png` (`docs/design/screens.md:74-80`) |
| 8.19 | Imagens e fontes locais (sem CDN) | ✅ | `@fontsource-variable/roboto-mono` (woff2 em `dist/assets`); nenhuma URL externa em `src` fora de `src/mocks` (só os explorers simulados) e nenhuma em `index.html`. Observação: `@fontsource-variable/geist` está em `package.json` sem uso |
| 8.20 | Substituições de asset e ajustes de a11y documentados | 🟡 | Favicon documentado (`ARCHITECTURE.md:3-20`); inconsistências do Figma em `docs/design/screens.md:55-67`. **Faltam** em ARCHITECTURE.md os ajustes de a11y (checkboxes nos filtros, skip link, texto "Esgotada", regiões aria-live, botões de ação do card sempre visíveis no toque) e os desvios de 8.1 |

### Seção 9 — Testes com Playwright

| # | Requisito | Status | Evidência |
|---|---|---|---|
| 9.1 | Busca, filtros combinados, ordenação, paginação, histórico | ✅ | `e2e/catalog.spec.ts` testes 1, 2, 2b, 3, 4, 5 |
| 9.2 | Acesso direto ao detalhe e recurso inexistente | ✅ | `catalog.spec.ts` "10" |
| 9.3 | Cadastro, login, expiração, logout, troca de usuário | ✅ | `account-session.spec.ts` 1–9 |
| 9.4 | Favoritos com falha de mutation e recuperação | ✅ | `account-favorites.spec.ts` "12a", "12b" |
| 9.5 | Carrinho, quantidades, remoção, cupom, persistência após refresh/login | ✅ | `cart.spec.ts` 1–9b |
| 9.6 | Compra completa do catálogo ao recibo confirmado | ✅ | `purchase.spec.ts` "10. compra completa: catálogo, detalhe, carrinho, checkout, revisão, pendente e recibo confirmado" |
| 9.7 | Falha de pagamento, clique repetido, timeout com recuperação | ✅ | `failures.spec.ts` "1", "2", "3" |
| 9.8 | Perfil, avatar, senha e carteiras com erros de validação | ✅ | `account-profile.spec.ts` 13–17; `account-wallets.spec.ts` 18–22 |
| 9.9 | Preço/disponibilidade via Socket.IO durante o checkout | ✅ | `realtime.spec.ts` "11a", "11b" |
| 9.10 | Duplicados, antigos, desconexão e retomada de pendente | ✅ | `realtime.spec.ts` "12", "13", "15", "16", "17" |
| 9.11 | Teclado, foco de diálogos e validação | ✅ | `a11y.spec.ts` 1–4 |
| 9.12 | Skeletons em carregamento lento, falha e nova tentativa | 🟡 | `catalog.spec.ts` "9" e "7"; `responsive.spec.ts` "13a", "13b"; `cart.spec.ts` "8b". Os testes verificam presença e dimensões, **não** a pintura; por isso não pegaram o defeito 8.6 |
| 9.13 | Chromium desktop e mobile | ✅ | `playwright.config.ts:37-46` |
| 9.14 | Regressão visual de início, detalhe, carrinho e pagamento, com baselines versionadas | ✅ | `e2e/visual.spec.ts` "14a"–"14d"; 8 PNGs em `e2e/__screenshots__/{desktop,mobile}/visual.spec.ts/` (git ls-files) |
| 9.15 | Dados estáveis nas baselines | ✅ | `reset()` + cenário default; animações desligadas (`playwright.config.ts:27-33`) |
| 9.16 | Estado isolado por teste | ✅ | `e2e/fixtures.ts:11-23` (limpa storages, `reset()`, recarrega) |
| 9.17 | Relógio, latência e eventos controlados | ✅ | `page.clock` em 6 arquivos (a11y, failures, fixtures, realtime, resilience-helpers, visual); `configure({ latencyMs, orderSettleMs })`; `emit*` |
| 9.18 | Relatório HTML e traces das falhas | ✅ | `reporter html`, `trace: 'retain-on-failure'`, `pnpm test:e2e:report` |
| 9.19 | Verificações na UI e nos resultados | ✅ | Os testes conferem a tela e as respostas (`waitForResponse`, `listSockets`, `inspectQueryCache`) |
| 9.20 | Tempo real pelo cliente Socket.IO; REST pelos handlers MSW | ✅ | `e2e/fixtures.ts` (emissão pelo servidor simulado) |
| 9.21 | Rota inexistente coberta | 🟡 | Não é exigida literalmente na lista de 12 grupos, mas a seção 4 pede o tratamento; não há teste de `/rota-qualquer` (ver 4.14) |

### Seção 10 — Lighthouse

| # | Requisito | Status | Evidência / o que falta |
|---|---|---|---|
| 10.1 | Início e detalhe, mobile e desktop | ✅ | `lighthouse/run.mjs`; `/` e `/nft/nft_003` |
| 10.2 | Build otimizado e cenário padrão | ✅ | `pnpm build` + `pnpm preview`; `mswWorkerStatus`/`apiOk` em `summary.json` |
| 10.3 | Performance ≥ 90 | ❌ | Medianas: `/` mobile **64**, `/nft/nft_003` mobile **79**; desktop 98 e 98 |
| 10.4 | Accessibility ≥ 95 | ✅ | 100 nas 4 combinações |
| 10.5 | Best Practices ≥ 95 | ✅ | 100 nas 4 |
| 10.6 | SEO ≥ 90 | ✅ | 92 nas 4 |
| 10.7 | 3 medições por página e perfil, com mediana | ✅ | 12 runs em `lighthouse/reports/`; `runsPerCombination: 3` |
| 10.8 | Configuração versionada | ✅ | `lighthouse/run.mjs` (git ls-files) |
| 10.9 | Relatórios HTML e JSON | ✅ | 24 arquivos versionados |
| 10.10 | Versões, ambiente e condições | ✅ | `RESULTADOS.md` "Ambiente e condições" (Lighthouse 13.6.0, HeadlessChrome 158, Node 26.13.1, pnpm 12.21.0, CPU, memória) |
| 10.11 | LCP, CLS e TBT | ✅ | Tabela de medianas + FCP e Speed Index |
| 10.12 | Justificativa abaixo da meta e causas | 🟡 | Análise boa (MSW no caminho crítico, PNGs de 450 KB, JS não usado). **Inconsistências**: a seção "Ruído de medição" cita números da rodada anterior ("Performance de 53 a 59", "TBT de 743 a 2286 ms"), que não batem com a mediana atual de 64; e a tabela do README (`README.md:105-110`) está defasada (53/97/57/89, CLS 0.186). **Correção**: atualizar os dois textos (10 min) |
| 10.13 | Sem simplificações exclusivas para a nota | ✅ | `RESULTADOS.md` "Nada foi simplificado"; o MSW é carregado em todas as medições |

### Seção 11 — Critérios / eliminatórios

| # | Requisito | Status | Evidência |
|---|---|---|---|
| 11.1–11.6 | Os seis eliminatórios | ✅ | Seção 2 deste documento |

### Seção 12 — Entrega

| # | Requisito | Status | Evidência / o que falta |
|---|---|---|---|
| 12.1 | Código, lockfile, assets, mocks, fixtures, testes e configuração de auditoria no repo | ✅ | `git ls-files` (337 arquivos): `pnpm-lock.yaml`, `public/assets/*`, `public/mockServiceWorker.js`, `src/mocks/**`, `e2e/**`, baselines, `lighthouse/**` |
| 12.2 | Deploy obrigatório, URL pública | ✅ | https://nft-marketplace-delta-ruby.vercel.app responde 200 |
| 12.3 | Versão publicada corresponde ao código entregue | ❔ | Os hashes diferem: deploy `index-DytmtB3O.js`/`index-DvT5ESr6.css`, build local `index-SHMzYx2X.js`/`index-7WbTP-Ed.css`. Pode ser o build no Linux da Vercel ou um deploy anterior aos dois últimos commits. Ver seção 5 |
| 12.4 | Mocks e tempo real funcionando no deploy | ✅ | Chromium headless no deploy: `window.__mocks` presente, `listSockets()` → `[{state:"connected"}]`, `setNftPrice` atualizou o card de 1.19 para 2.50 ETH sem reload |
| 12.5 | Acesso direto e refresh das rotas no deploy | ✅ | `curl`: `/`, `/nft/nft_001`, `/cart`, `/checkout`, `/orders/ord_x`, `/rota-inexistente` → 200 `text/html`; `/mockServiceWorker.js` → 200 com `Cache-Control: no-cache`; `/nft/nft_001` renderiza o h1 correto |
| 12.6 | README: setup | ❌ | `README.md:1-75` é o template do Vite em inglês. Não há "instale com pnpm install", pré-requisitos (Node ≥ 26, pnpm 12) nem "pnpm dev" |
| 12.7 | README: variáveis de ambiente | 🟡 | Só aparece na seção Deploy (`README.md:121, 128-130`); não diz que dev precisa de `.env.local` |
| 12.8 | README: credenciais fictícias | 🟡 | Estão em `docs/API.md:184-189`, sem link no README |
| 12.9 | README: seleção e reset de cenários | 🟡 | Em `docs/SCENARIOS.md`, sem link no README |
| 12.10 | README: comandos de execução | 🟡 | Testes e Lighthouse documentados (`README.md:84-101`); faltam dev, build, preview, typecheck e lint |
| 12.11 | README: reproduzir fluxos de falha | 🟡 | A tabela de `docs/SCENARIOS.md` tem "Como reproduzir", sem link no README |
| 12.12 | Documentar contratos REST e eventos | ✅ | `docs/API.md`, `docs/REALTIME.md` |
| 12.13 | Documentar política de sessão | 🟡 | Parcial em `docs/API.md:7-8, 26-37` e `docs/REALTIME.md:34-47`; nada sobre o cliente (restore, 401, limpeza, retomada no checkout) fora de comentários em `session.ts` |
| 12.14 | Documentar estado do carrinho | 🟡 | Mescla em `docs/API.md:35`; nada sobre carrinho de visitante (`guestId.ts`), cotação como fonte dos valores ou reação a eventos |
| 12.15 | Documentar estratégia de cache | 🟡 | Ver 4.17 |
| 12.16 | Documentar reconciliação REST × Socket.IO | 🟡 | `docs/REALTIME.md:86-98, 133` descreve versionamento e "o cliente deve reconciliar"; o que o cliente faz (`reconcileWithApi`, polling do pendente) está só no código |
| 12.17 | ARCHITECTURE.md: limitações | ❌ | Ausente (só em `docs/REALTIME.md:129-141`) |
| 12.18 | ARCHITECTURE.md: decisões de UX | ❌ | Ausente em ARCHITECTURE.md; existem em `docs/design/screens.md:30-53`, sem referência |
| 12.19 | ARCHITECTURE.md: desvios do Figma | 🟡 | Só favicon e meta tags; as 11 inconsistências estão em `docs/design/screens.md:55-67`, sem referência |
| 12.20 | Comando: dev com mocks | 🟡 | `pnpm dev` existe, mas depende de `.env.local` não versionado (ver 6.36) |
| 12.21 | Comandos: build, preview, typecheck, lint | ✅ | `package.json`; build, typecheck e lint rodados com exit 0 |
| 12.22 | Comando: Playwright | ✅ | `test:e2e`, `test:e2e:ui`, `test:e2e:report`, `test:a11y`, `test:visual` |
| 12.23 | Comando: Lighthouse | ✅ | `lighthouse`, `lighthouse:report` |
| 12.24 | Executa de checkout limpo sem serviços privados | 🟡 | Sem backend nem serviços privados; `node_modules`, `dist`, `test-results` e `playwright-report` ignorados corretamente; nada necessário fica fora do git, **exceto** `.env.local` para o `pnpm dev`. Observação: `engines.node >=26` e `packageManager pnpm@12.21.0` são exigentes, documente isso no setup |

---

## 4. Correções priorizadas (pontos recuperáveis ÷ esforço)

| # | Correção | Pontos recuperáveis (estim.) | Esforço | Arquivos |
|---|---|---|---|---|
| 1 | Versionar `.env.development` com a flag dos mocks | +0,5 (mocking, arquitetura) | 5 min | `.env.development` (novo), `README.md` |
| 2 | Corrigir a colisão `.shimmer` (skeletons invisíveis) + teste de pintura | +2 (visual, a11y, integração) | 20 min | `src/index.css`, 9 componentes, `e2e/a11y.spec.ts` |
| 3 | Reescrever o README (setup, env, credenciais, cenários, comandos, falhas) | +2 (arquitetura e doc) | 40 min | `README.md` |
| 4 | Ampliar o ARCHITECTURE.md (limitações, UX, desvios, sessão, carrinho, cache, reconciliação) | +2 (arquitetura, integração) | 60 min | `ARCHITECTURE.md` |
| 5 | Atualizar os números do Lighthouse no README e na análise | +0,25 (performance) | 10 min | `README.md`, `lighthouse/RESULTADOS.md`, `lighthouse/analise.md` |
| 6 | Teste E2E e título para rota inexistente | +0,25 | 15 min | `src/components/RouteStatus.tsx`, `e2e/smoke.spec.ts` |
| 7 | Remover o projeto `tablet` morto do Playwright e a dependência `geist` | +0,1 | 5 min | `playwright.config.ts`, `package.json` |
| 8 | Ajustes desktop: imagem do Violet Nomad, ícones sociais, "Utilidade" no rodapé | +0,5 (visual) | 30 min | seed/`src/components/layout/Footer.tsx`, `content.ts` |
| 9 | Aproximar a home mobile do Figma (busca acima do hero, grid em zigue-zague, só o coração no card) | +1,5 (visual) | 2 h | `src/features/home/HomeHero.tsx`, `CatalogSection.tsx`, `NftGrid.tsx`, `NftCard.tsx` |
| 10 | Performance mobile: render do shell antes do MSW, imagens WebP com `srcset`, preload da fonte | +1,5 (performance) | 3–4 h + nova rodada | `src/main.tsx`, `public/assets`, `index.html`, `lighthouse/*` |
| 11 | Confirmar que o deploy corresponde a `b4152e3` | protege a entrega | 5 min | painel da Vercel |

### Prompts prontos para o Claude Code

**1. `.env.development`**
```
Crie .env.development (versionado) com VITE_ENABLE_MOCKS=true para que `pnpm dev` num checkout limpo suba com MSW e Socket.IO simulado. Confirme que .gitignore não o ignora (só *.local). No README, na seção de setup, diga que dev e build já ligam os mocks por .env.development e .env.production e que .env.local é opcional. Rode pnpm typecheck && pnpm lint.
```

**2. Skeletons invisíveis**
```
Os skeletons estão invisíveis: a classe .shimmer de src/index.css colide com a utility `shimmer` de shadcn/tailwind.css (importada em src/index.css), que aplica background-clip: text. Renomeie a classe do projeto para .skeleton-bone (e .shimmer-strong para .skeleton-bone-strong) em src/index.css e em todos os usos (grep "shimmer" em src: CartItemRow, CartSummary, CouponForm, NftDetailSkeleton, FilterPanel, NftCard, OrderSummary, WalletSection, HomeHero). Mantenha a animação e o @media (prefers-reduced-motion). Aumente o contraste do osso: fundo var(--surface-strong) e realce do gradiente em 0.22. Atualize os seletores '.shimmer' em e2e/a11y.spec.ts (testes 9a e 9c) e acrescente neles uma verificação de que getComputedStyle(bone).backgroundClip !== 'text' e de que backgroundColor é diferente do fundo da página. Rode só e2e/a11y.spec.ts, e2e/catalog.spec.ts -g "skeleton" e e2e/responsive.spec.ts -g "13a", depois pnpm typecheck && pnpm lint.
```

**3. README**
```
Reescreva README.md em português, removendo o template do Vite (linhas 1-75). Estrutura: 1) O que é (Kurio, link do deploy https://nft-marketplace-delta-ruby.vercel.app); 2) Pré-requisitos (Node >= 26, pnpm 12.21.0 via corepack); 3) Setup (pnpm install, pnpm exec playwright install chromium); 4) Variáveis de ambiente (VITE_ENABLE_MOCKS em .env.development/.env.production/.env.example); 5) Comandos (dev, build, preview, typecheck, lint, test:e2e, test:e2e:ui, test:e2e:report, test:a11y, test:visual, test:visual:update, lighthouse, lighthouse:report), com o que cada um faz; 6) Credenciais fictícias (copie a tabela de docs/API.md "Dados de demonstração" e os cupons); 7) Cenários: seleção por ?scenario=nome&seed=n, window.__mocks.setScenario/reset e link para docs/SCENARIOS.md; 8) Reproduzir fluxos de falha: um passo a passo curto por cenário (offline, server-error, session-expired, register-conflict, coupon-invalid/expired, price-changed, sold-out, order-timeout, payment-rejected, wallet-rejected, queda do socket com __mocks.disconnectSockets/reconnectSockets); 9) Estrutura do projeto; 10) Testes (manter o texto atual); 11) Lighthouse (atualizar a tabela com as medianas de lighthouse/summary.json: / mobile 64, / desktop 98, /nft/nft_003 mobile 79, desktop 98, com LCP/CLS/TBT de lá); 12) Deploy (manter); 13) Links para ARCHITECTURE.md, docs/API.md, docs/REALTIME.md, docs/SCENARIOS.md. Não invente números: leia lighthouse/summary.json e docs/*.md.
```

**4. ARCHITECTURE.md**
```
Amplie ARCHITECTURE.md mantendo a seção atual de assets. Acrescente, lendo o código para não inventar: 1) Visão geral e organização por feature; 2) Fluxo de dados (Router → Query → Axios com validação Zod em src/lib/api.ts → MSW); 3) Política de sessão (src/features/auth/session.ts, src/router.ts: restore após refresh, 401 → expire + redirect com reason=expired, limpeza de cache/storage/socket no logout e na troca de usuário, o que sobrevive à expiração para retomar o checkout); 4) Estado do carrinho (dono usuário ou guestId, cotação como fonte dos valores, mescla no login, reação a nft.updated); 5) Estratégia de cache, retries e sincronização (src/lib/queryClient.ts, queryKeys.ts, keepPreviousData, AbortSignal, staleTime, retries só transitórios, mutations sem retry, otimistas com rollback em favoritos/carrinho/perfil); 6) Reconciliação REST × Socket.IO (VersionTracker, cacheSync, bus, reconcileWithApi na reconexão, polling do pedido pendente sem socket, estados terminais); 7) Decisões de UX (resuma docs/design/screens.md "Pagamento: decisões" e "Fora do escopo"); 8) Desvios do Figma (as 11 inconsistências de screens.md e os desvios atuais: filtros com checkbox, rede Base no lugar de Solana, ações do card sempre visíveis no mobile, posição da busca mobile, ícones sociais em texto e quaisquer outros que você confirmar comparando docs/design/*.png); 9) Ajustes de acessibilidade em relação ao layout; 10) Limitações (traga as de docs/REALTIME.md e acrescente: estado dos mocks no localStorage por navegador, sem backend real, performance mobile limitada pelo MSW no caminho crítico). Use links para os arquivos. Rode pnpm lint.
```

**5. Números do Lighthouse**
```
Em lighthouse/RESULTADOS.md e lighthouse/analise.md, a seção "Ruído de medição" cita números de uma rodada anterior ("Performance de 53 a 59", "TBT de 743 a 2286 ms", "1317 → 722 ms") que não batem com lighthouse/summary.json. Reescreva o parágrafo com a faixa real dos 3 runs de cada combinação, lida do summary.json. Se RESULTADOS.md é gerado por lighthouse/run.mjs, ajuste o gerador para calcular a faixa em vez de texto fixo. Não rode o Lighthouse de novo.
```

**6. Rota inexistente**
```
Em src/components/RouteStatus.tsx, faça NotFoundPage definir o título "Página não encontrada | Kurio" com o hook useDocumentTitle de src/lib. Acrescente em e2e/smoke.spec.ts um teste: goto('/rota-que-nao-existe') mostra o heading de nível 1 "Página não encontrada", o link "Voltar ao início" leva a "/" e o título contém "Página não encontrada". Rode só esse arquivo e pnpm typecheck && pnpm lint.
```

**7. Limpeza de configuração**
```
Remova de playwright.config.ts o projeto 'tablet' (que aponta para layout.spec.ts, inexistente) e os testIgnore /layout\.spec\.ts/ dos outros projetos; os 768 px já são cobertos por e2e/responsive.spec.ts. Remova @fontsource-variable/geist de package.json se nenhum arquivo o importar (grep) e atualize o lockfile com pnpm install --lockfile-only. Rode pnpm typecheck && pnpm lint.
```

**8. Ajustes visuais no desktop**
```
Compare docs/design/checkout-desktop.png e home-desktop.png com o app (pnpm preview) e corrija: 1) no seed, Violet Nomad #314 deve usar a imagem Sape.png (macaco de chapéu), como no Figma; se mudar o seed, suba a versão do esquema e atualize as baselines visuais afetadas; 2) os ícones das redes sociais do rodapé devem ser ícones (lucide-react ou SVG local) com aria-label, e não as letras "f/ig/x/in/yt"; 3) a coluna "Coleções" do rodapé deve incluir "Utilidade"; 4) aproxime o tamanho do texto do rodapé do frame. Registre em ARCHITECTURE.md o que não for seguido. Rode e2e/visual.spec.ts e, se a mudança for intencional, test:visual:update e confira as imagens.
```

**9. Home mobile**
```
Aproxime a home em 390 px de docs/design/home-mobile.png: busca "Explorar coleções" + botão de filtros acima do hero; grid de 2 colunas com a coluna direita deslocada para baixo (zigue-zague do frame); no card mobile, só o botão de favorito sobre a imagem (carrinho e ver ficam acessíveis no detalhe ou num menu, mantendo foco e aria-labels); avalie a miniatura sobreposta no hero. Não quebre os testes de catalog/a11y/responsive; atualize as baselines mobile de e2e/visual.spec.ts conscientemente. Documente em ARCHITECTURE.md o que ficou diferente e por quê.
```

**10. Performance mobile**
```
Melhore a Performance mobile do Lighthouse (hoje 64 em / e 79 em /nft/nft_003) sem simplificar a entrega: 1) em src/main.tsx, renderize o app (shell + skeletons) sem esperar enableMocking(), fazendo as chamadas /api e o socket aguardarem uma promessa "mocksReady" exportada de src/lib (sem importar src/mocks no grafo estático); 2) gere WebP das imagens de public/assets (mantenha os PNGs como fallback) e use <picture>/srcset com tamanhos por viewport no hero, card e galeria; 3) preload do woff2 latin do Roboto Mono no index.html. Rode a suíte E2E afetada (smoke, catalog, realtime) e depois pnpm lighthouse; atualize RESULTADOS.md e o README com as novas medianas.
```

**11. Deploy**
```
Verifique se o deploy de produção na Vercel corresponde ao commit b4152e3: compare o SHA do último deployment de produção (vercel ls / painel) com git rev-parse HEAD. Se não corresponder, faça um redeploy sem cache. Depois confira https://nft-marketplace-delta-ruby.vercel.app/nft/nft_001 com refresh.
```

---

## 5. Itens NÃO VERIFICÁVEIS e como conferir à mão

| # | Item | Por que não foi possível | Como conferir |
|---|---|---|---|
| N1 | Deploy = código entregue (12.3) | Os hashes do bundle publicado (`index-DytmtB3O.js`) diferem do build local no Windows (`index-SHMzYx2X.js`); a diferença pode ser só de plataforma | No painel da Vercel → Deployments → Production, confira se o commit é `b4152e3`. Ou abra o site, procure "PageSkeleton" no bundle pelo DevTools → Sources: o componente foi removido em `f4d55c8` e não deve existir |
| N2 | Suíte E2E completa no estado atual | A execução foi vetada; uso o último resultado conhecido (340 ✓ / 4 skip) | `pnpm test:e2e`, depois `pnpm test:e2e:report`. As baselines visuais foram geradas no Windows e podem divergir em outro SO (`README.md:91`) |
| N3 | Fidelidade às medidas exatas do Figma | Só há PNGs exportados; `docs/design/tokens.md` diz "Valores estimados dos prints. Confirmar no Figma" | Abra o Figma com o inspecionar e compare tamanhos de fonte e espaçamentos de Display, Heading e rodapé com `src/index.css` |
| N4 | Tempo real em abas em segundo plano e redes móveis reais | Só testado em headless local e no deploy por alguns segundos | No celular, abra o deploy, entre como Ana, inicie um pedido com `?scenario=default` e deixe a aba em segundo plano por 1 minuto; ao voltar, o pedido deve estar confirmado sem nova compra |

---

## 6. Estimativa de nota por critério

| Critério | Nota | Justificativa (1 linha) | Principal fator que reduz |
|---|---|---|---|
| Fidelidade visual e responsividade | **15/20** | Desktop muito fiel ao Figma; 390/768/1440 sem overflow e com reflow em 320 | Skeletons invisíveis e desvios da home mobile (busca, grid, ações do card) |
| Fluxos e experiência de uso | **18/20** | Compra, conta, carteiras, cupom, expiração e falhas completos e testados | Estados de carregamento sem feedback visual (área vazia no cenário lento) |
| Integração e estado | **14/15** | Router, Query, Axios+Zod, chaves por usuário, AbortSignal, otimista com rollback | Política de cache, retries e sync só em comentários de código |
| Tempo real | **10/10** | Versão, duplicatas, reconexão com reconciliação, isolamento, liberação de listeners, pendente com queda | — |
| Mocking | **9/10** | 17 cenários determinísticos, socket via binding, reset completo, ativo no build | `pnpm dev` de checkout limpo sem mocks (`.env.local` não versionado) |
| Testes | **9/10** | 12 grupos cobertos, desktop+mobile, visual versionado, relógio e eventos controlados | Os testes de skeleton não detectaram a pintura quebrada; projeto tablet morto |
| Acessibilidade | **4,5/5** | Teclado, foco, diálogos, aria-live, alt, reduced motion e Lighthouse 100 | Placeholder de carregamento imperceptível |
| Performance | **3/5** | Desktop 98/98; análise com causas e oportunidades | Mobile 64 e 79, abaixo de 90 |
| Arquitetura e documentação | **2/5** | Código bem tipado e separado por feature; API/REALTIME/SCENARIOS bons | README com o template do Vite e ARCHITECTURE.md quase vazio |
| **Total** | **≈ 84,5/100** | | Corrigir os itens 1–5 da seção 4 (≈ 2 h 15 min) recupera cerca de 7 pontos, para ≈ 91 |
