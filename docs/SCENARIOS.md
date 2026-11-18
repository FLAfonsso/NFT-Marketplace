# Cenários de rede e falha (MSW)

Implementação em `src/mocks/scenarios`. Valem para toda rota REST em `/api` (dev e build de demonstração com `VITE_ENABLE_MOCKS=true`). Contratos e regras normais da API: [API.md](API.md).

## Como funciona

- **Um cenário ativo por vez.** Todo handler passa por `route()` (`src/mocks/handlers/utils.ts`), que delega a `withScenario()`. Ele aplica a latência do cenário, executa o gatilho `before` (que pode responder no lugar do handler) e o ajuste `after` (que pode trocar ou segurar a resposta). Nenhum handler testa o cenário por conta própria.
- **Cenários de dados** (`empty`, `coupon-invalid`, `coupon-expired`) alteram o banco simulado, para REST e eventos ficarem coerentes. A troca é idempotente, e sair do cenário desfaz o ajuste.
- **Cenários de pagamento** forçam o resultado da liquidação dos pedidos pendentes.
- **Determinismo.** Não há `Math.random`. A latência variável vem da seed e da posição da requisição, e os gatilhos usam contadores (o *runtime*). Mesma seed e mesma sequência de requisições dão o mesmo resultado.
- **Persistência.** Cenário, seed, opções e runtime ficam em `localStorage` (`nft-marketplace:mocks:scenario`) e sobrevivem ao refresh. O banco fica em `nft-marketplace:mocks:db`.

### Seleção

1. `?scenario=<nome>` na URL (e, opcionalmente, `?seed=<n>`). Se o nome difere do salvo, o cenário começa do zero. Se é o mesmo, o runtime continua, ou seja, um refresh não dispara de novo um gatilho já disparado.
2. Sem parâmetro: o cenário salvo no `localStorage`.
3. Sem nada salvo: `default`.

Um nome desconhecido na URL é ignorado, com um aviso no console. Enquanto o parâmetro estiver na URL, ele vence o que foi escolhido pelo console.

### Painel `window.__mocks`

Só existe quando `VITE_ENABLE_MOCKS=true`, inclusive no build de produção.

| Função | Efeito |
|---|---|
| `listScenarios()` | `[{ name, summary }]` de todos os cenários |
| `getScenario()` | `{ name, summary, seed, options, runtime }` do cenário ativo |
| `setScenario(nome, { seed?, latencyMs?, failures?, afterRequests? })` | ativa o cenário do zero (runtime zerado), mesmo se já for o ativo. Sem `seed`, usa 1. Nome inválido lança erro |
| `reset()` | restaura o banco do seed, as configurações padrão e o cenário `default` |

Os controles finos (`configure`, `failNext`, `expireSessions`, `setNftPrice`, `setEditionAvailable`) continuam disponíveis e se combinam com qualquer cenário (ver API.md). Os controles de tempo real (`emitNftUpdate`, `emitOrderUpdate`, `emitDuplicate`, `emitStale`, `disconnectSockets`, `reconnectSockets`, `listSockets`, `probe`) estão em [REALTIME.md](REALTIME.md).

**Recomendado:** troque de cenário e recarregue a página, para o app buscar tudo de novo no novo estado:

```js
window.__mocks.setScenario('jitter', { seed: 42 }); location.reload()
```

No Playwright, prefira a URL num contexto novo, que já começa com `localStorage` vazio:

```ts
await page.goto('/?scenario=server-error')
// ou, com a página aberta:
await page.evaluate(() => window.__mocks!.setScenario('sold-out'))
await page.reload()
```

## Cenários

| Nome | Efeito | Como reproduzir |
|---|---|---|
| `default` | Sucesso normal, latência padrão de 150 ms (`configure({ latencyMs })`). Carteira terminada em `dead` recusa o pagamento. | `?scenario=default` ou `reset()` |
| `empty` | Catálogo, favoritos, carrinhos, carteiras e pedidos vazios. Usuários e sessões ficam: dá para entrar e ver os estados vazios. | `?scenario=empty`; abrir catálogo, favoritos, carrinho, perfil e pedidos |
| `slow` | Toda resposta demora o mesmo tempo, 3000 ms por padrão. | `?scenario=slow` ou `setScenario('slow', { latencyMs: 5000 })` |
| `jitter` | Latência de 100 a 2500 ms, derivada da seed e da ordem da requisição. Requisições paralelas ou em sequência rápida chegam fora de ordem. | `?scenario=jitter&seed=7`; digitar rápido na busca ou trocar de página/filtro em sequência |
| `offline` | Toda requisição falha como erro de rede (`HttpResponse.error()`; o Axios recebe `ERR_NETWORK`, sem `response`). | `?scenario=offline`; depois `setScenario('default')` para testar a recuperação sem recarregar |
| `server-error` | As primeiras N chamadas de **cada rota** (método + caminho) respondem 500 e depois 503 (com `Retry-After: 1`), alternando. Depois disso, a rota volta ao normal. N = 2 por padrão. | `?scenario=server-error`: a 1ª chamada de `GET /api/nfts` dá 500, a 2ª dá 503, a 3ª dá 200. `setScenario('server-error', { failures: 3 })` muda N |
| `client-errors` | `GET /api/nfts/:id` → 404. `GET /api/orders/:id` e `PUT /api/wallets/:id` → 403. Todo outro POST/PUT/PATCH com corpo → 400 `validation`, com `fieldErrors` em cada campo enviado (`name`, `buyer.email`, `items.0.quantity`). Login e logout funcionam normalmente. | `?scenario=client-errors`; abrir um NFT, um pedido, salvar o perfil ou uma carteira |
| `session-expired` | Depois de N requisições autenticadas com sucesso (padrão 5), o token expira de fato: aquela e as próximas respondem 401 "Sessão expirada". Após entrar de novo, a navegação segue normal, e o token expira em `POST /api/orders` (checkout). Depois de mais um login, tudo funciona. | `?scenario=session-expired`; entrar e navegar. `setScenario('session-expired', { afterRequests: 2 })` antecipa a expiração |
| `register-conflict` | `POST /api/auth/register` com corpo válido → 409 `conflict` com `fieldErrors.email`. Corpo inválido segue para o 400 normal. | `?scenario=register-conflict`; cadastrar com qualquer e-mail |
| `coupon-invalid` | Nenhum cupom existe. A cotação responde `coupon.status: "invalid"` e desconto `0`. | `?scenario=coupon-invalid`; aplicar `BEMVINDO10` no carrinho |
| `coupon-expired` | Todos os cupons estão vencidos. A cotação responde `coupon.status: "expired"` e desconto `0`. | `?scenario=coupon-expired`; aplicar `BEMVINDO10` |
| `price-changed` | Na primeira confirmação de pedido do cenário, o preço do primeiro item da cotação sobe 10 % (emite `nft.updated`). O pedido responde 409 `OrderConflict` com `reason: "price_changed"` e a **nova cotação** (com aviso `price_changed`). Confirmar com a nova cotação cria o pedido. | Entrar como Ana, `?scenario=price-changed`, revisar e confirmar. Para repetir, `setScenario('price-changed')` |
| `sold-out` | Na primeira confirmação de pedido do cenário, a edição do primeiro item esgota (`available: 0`, emite `nft.updated`). O pedido responde 409 `OrderConflict` com `reason: "sold_out"`, `nftId`, `editionId` e `available`. | Igual a `price-changed`, com `?scenario=sold-out` |
| `order-timeout` | Todo pedido **novo** é criado (estoque reservado, liquidação agendada), mas a resposta 201 nunca chega: o cliente vê timeout. Reenviar com a **mesma** `Idempotency-Key` responde 200 com o mesmo pedido e `Idempotent-Replayed: true`. Uma chave nova cria outro pedido, que também fica sem resposta: é assim que a duplicidade aparece. | `?scenario=order-timeout`; confirmar, esperar o timeout do Axios, tentar de novo |
| `payment-confirmed` | Todo pedido pendente é confirmado, mesmo com carteira terminada em `dead`. | `?scenario=payment-confirmed`; comprar com a carteira "Sem saldo" do Bruno |
| `payment-rejected` | Todo pedido pendente é recusado (`rejectionReason`), e o estoque reservado é devolvido. | `?scenario=payment-rejected`; comprar com qualquer carteira |

### Detalhes e limites

- **Ordem dentro de uma requisição:** latência do cenário → gatilho `before` → falhas de `failNext` → handler → `after`. A latência de `slow` e `jitter` substitui `mockSettings.latencyMs`.
- **jitter:** a latência depende da posição da requisição desde a ativação. Com `seed: 7`, seis `GET /api/nfts?page=1..6` disparados juntos chegam na ordem `3,4,5,6,1,2`. Uma mudança na ordem de disparo do app muda as latências atribuídas.
- **`price-changed` e `sold-out`** disparam uma vez por ativação. Repetições de um pedido já criado (mesma chave) não disparam o gatilho. Fora desses cenários, a API responde o mesmo 409 tipado sempre que o preço ou o estoque mudam de verdade (por exemplo, com `setNftPrice`).
- **`payment-*`** decidem o resultado na hora da liquidação. Um pedido pendente criado em outro cenário segue a regra do cenário ativo quando liquidar.
- **`empty`:** ao entrar, os dados são guardados no próprio banco (`stash`). Ao sair, eles voltam, e a versão dos carrinhos continua crescendo. Uma carteira criada durante o `empty` só fica se o usuário não tinha nenhuma antes. Entrar e sair não emite eventos de remoção ou recriação: recarregue a página.
- **Socket.IO:** por enquanto, os cenários atuam só no REST. Mudanças de dados feitas pelos gatilhos (`price-changed`, `sold-out`) e pela liquidação passam pelo emissor do store, que é a fonte dos eventos em tempo real.
- **Multiabas:** o cenário é lido na carga da página. Outra aba só vê a troca depois de recarregar.
