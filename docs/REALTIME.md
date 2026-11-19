# Tempo real simulado (Socket.IO sobre MSW)

Implementação em `src/mocks/realtime`. Só existe com `VITE_ENABLE_MOCKS=true` (dev e build de demonstração). Contratos dos eventos: `src/contracts/events.ts`. Cenários: [SCENARIOS.md](SCENARIOS.md). REST: [API.md](API.md).

| Arquivo | Papel |
|---|---|
| `realtime/socket.ts` | servidor Socket.IO simulado: handshake, salas, heartbeat, entrega, queda simulada |
| `realtime/events.ts` | tradução das mudanças do store para os eventos do contrato, e histórico |
| `realtime/control.ts` | funções do painel `window.__mocks` e `probe()` |

## Transporte

- **MSW `ws.link`** intercepta, no próprio navegador, o `WebSocket` criado pelo `socket.io-client`. O link é a origem da página, e o caminho é o padrão `/socket.io/`. O MSW remove esse prefixo antes de casar o handler. Só são tratadas URLs `/socket.io/?EIO=4&transport=websocket`. Qualquer outro WebSocket da mesma origem (ex.: reconexão do HMR do Vite) segue para o servidor real com `server.connect()`.
- **`@mswjs/socket.io-binding`** (`toSocketIo`) codifica os pacotes de evento (`42["nft.updated",{…}]`) dentro de frames Engine.IO.
- **O handshake é feito em `socket.ts`, não no binding.** Sem servidor real, o binding responde sozinho com `OPEN` e `CONNECT` aceito, antes de o cliente enviar o `auth`, ou seja, aceitaria qualquer conexão. Ele deixa de fazer isso quando o handle do servidor expõe `socket`. `socket.ts` passa ao binding um proxy do handle com esse campo e assume o handshake: envia o `OPEN`, lê o `CONNECT` do cliente, valida o token e só então responde `CONNECT` (aceito) ou `CONNECT_ERROR`.
- **Heartbeat:** o servidor envia `ping` a cada 25 s (`pingInterval`), com `pingTimeout` de 60 s. O binding não faz isso, e sem `ping` o `socket.io-client` derruba a conexão com `ping timeout`.

### Como o app deve conectar

```ts
import { io, type Socket } from 'socket.io-client'
import type { ServerToClientEvents } from '@/contracts'

const socket: Socket<ServerToClientEvents> = io({
  transports: ['websocket'],      // obrigatório nos mocks: não há long-polling
  auth: (cb) => cb({ token }),    // token da sessão (Session.token); sem token = visitante
})
```

- **`transports: ['websocket']` é obrigatório.** O padrão do cliente começa por long-polling HTTP, que não é simulado.
- **O `socket.io-client` só pode ser avaliado depois de `enableMocking()`.** O `engine.io-client` guarda `globalThis.WebSocket` quando o módulo carrega, e o MSW só substitui o `WebSocket` em `worker.start()`. Se o módulo carregar antes, o cliente usa o `WebSocket` nativo e nunca chega ao mock (sintoma: `connect_error: timeout`). Na prática, nenhum módulo do grafo estático de `src/main.tsx` pode importar `socket.io-client`. Importe `App` (ou o módulo do socket) com `import()` depois de `prepare()`, ou crie o cliente de tempo real em um módulo carregado sob demanda. Pelo mesmo motivo, `probe()` importa o `socket.io-client` sob demanda.
- Use `auth` como função para o token ser lido de novo a cada reconexão.

## Handshake, sessão e salas

| Situação | Resultado no cliente |
|---|---|
| `auth.token` de sessão válida | `connect`. A conexão entra em `public` e em `user:<userId>` |
| sem `auth.token` | `connect` como visitante, só em `public` (recebe `nft.updated`, nunca `order.updated`) |
| token inexistente ou que não é string | `connect_error`, `message: "Sessão inválida."`, `data: { code: "unauthorized", reason: "invalid" }` |
| token vencido | `connect_error`, `message: "Sessão expirada."`, `data: { code: "unauthorized", reason: "expired" }` |
| namespace diferente de `/` | `connect_error`, `message: "Invalid namespace"` |
| sessão revogada (logout, troca de senha) ou vencida depois de conectar | `disconnect` com `"io server disconnect"`, no próximo evento ou ping. Não reconecta sozinho |

Depois de `connect_error` ou `io server disconnect`, o `socket.io-client` não tenta de novo sozinho (`socket.active === false`), como num servidor real. O app decide quando chamar `socket.connect()`, por exemplo depois de entrar de novo.

**Audiência:** `nft.updated` vai para `public`, ou seja, todas as conexões aceitas. `order.updated` vai só para `user:<event.userId>`, e cada conexão ainda é conferida (`userId` igual ao do evento, sessão válida) antes do envio. Um evento de pedido nunca sai para a conexão de outro usuário, nem para uma conexão cuja sessão acabou.

## Formato dos eventos

Validados com `RealtimeEvent` (`src/contracts/events.ts`) antes de sair. Um evento fora do contrato é descartado com `console.error`.

```jsonc
// nft.updated: preço ou estoque mudou
{
  "id": "evt:nft:nft_001:v2:1794971987311",
  "type": "nft.updated",
  "version": 2,
  "occurredAt": "2026-11-18T03:19:47.311Z",
  "resource": { "type": "nft", "id": "nft_001" },
  "payload": {
    "price": "1.5",
    "editions": [{ "id": "nft_001_ed1", "available": 19 }, { "id": "nft_001_ed2", "available": 10 }]
  }
}

// order.updated: pedido criado (pending) ou liquidado (confirmed / rejected)
{
  "id": "evt:order:ord_1002:v2:1794971988452",
  "type": "order.updated",
  "version": 2,
  "occurredAt": "2026-11-18T03:19:48.452Z",
  "resource": { "type": "order", "id": "ord_1002" },
  "userId": "usr_bruno",
  "payload": {
    "status": "confirmed",
    "transactionRef": { "hash": "0x…", "explorerUrl": "https://basescan.org/tx/0x…" },
    "rejectionReason": null
  }
}
```

- `payload.price` é string decimal em ETH. `available` é inteiro.
- `nft.updated` traz o estado completo de preço e disponibilidade (todas as edições), não um delta.

## Versionamento

- **A version vem do store.** Toda mudança de NFT (`mutateNft`) ou de pedido (criação, liquidação) incrementa `version` no próprio recurso. O evento carrega essa version, e `GET /api/nfts/:id` e `GET /api/orders/:id` devolvem o mesmo estado com a mesma version.
- **Ordem:** o store persiste a transação e só então publica. Então, quando o evento chega, o REST já responde o estado novo. O evento pode chegar antes da resposta REST da própria ação que o causou.
- **Regra para o cliente:** ignore eventos com `version` menor ou igual à que já tem para o recurso, e descarte `id` repetido.
- **`id`** = recurso + version + instante da mudança. Um reenvio do mesmo evento (`emitDuplicate`) tem o mesmo `id`. O instante entra para o `id` não se repetir depois de `reset()`, quando as versions voltam às do seed.
- **Pedidos:** criação emite `pending` com version 1, e a liquidação emite `confirmed`/`rejected` com version 2. A liquidação também emite `nft.updated` quando devolve estoque (recusa). Confirmado e recusado são terminais.

## Ligação com o store e os cenários

- `realtime/socket.ts` assina o emissor interno do store (`subscribe` em `src/mocks/db/store.ts`). Qualquer escrita que altera preço ou disponibilidade de NFT, ou status de pedido, vira evento: requisições REST (`POST /orders` reserva estoque), cenários (`price-changed`, `sold-out`), liquidação e painel (`setNftPrice`, `setEditionAvailable`, `emitNftUpdate`, `emitOrderUpdate`).
- **Pedido pendente:** liquidado depois de `orderSettleMs` (padrão 2500 ms, ajustável com `configure`). `payment-confirmed` força `confirmed`, `payment-rejected` força `rejected`, e nos demais cenários vale a regra da carteira (endereço terminado em `dead` recusa). Pendentes sobrevivem ao refresh e são liquidados depois de recarregar.
- **`reset()`** restaura o seed, e com ele as versions do seed (NFTs e pedidos voltam às versions iniciais). Também fecha todas as conexões (código 1012), encerra uma queda simulada e limpa o histórico usado por `emitDuplicate`/`emitStale`. Os clientes reconectam sozinhos. Como o seed não tem sessões, quem usava token recebe `connect_error` (`invalid`).

## Painel `window.__mocks`

Somam-se aos controles de [SCENARIOS.md](SCENARIOS.md).

| Função | Efeito |
|---|---|
| `emitNftUpdate({ nftId, price?, availability? })` | altera o NFT no store (version +1) e emite `nft.updated`. `availability`: número (todas as edições) ou `{ [editionId]: n }`, limitado a `[0, supply]`. Devolve o evento |
| `emitOrderUpdate({ orderId, status })` | liquida um pedido **pendente** como `"confirmed"` ou `"rejected"`, com os mesmos efeitos da liquidação automática (estoque, carrinho). Pedido terminal lança erro. Devolve o evento |
| `emitDuplicate()` | reenvia o último evento publicado, idêntico (mesmo `id` e `version`) |
| `emitStale()` | envia um evento com version anterior para o recurso do último evento: o evento antigo real, se estiver no histórico; senão, uma cópia com `version − 1` e `id` com sufixo `:stale` |
| `disconnectSockets()` | derruba todas as conexões (`transport close` no cliente) e recusa novas até `reconnectSockets()`. As tentativas falham com `websocket error`. Devolve quantas caíram |
| `reconnectSockets()` | volta a aceitar conexões. O cliente reconecta na próxima tentativa do backoff (até `reconnectionDelayMax`, 5 s por padrão) |
| `listSockets()` | conexões abertas: `{ id, socketId, state, userId }` |
| `socketStats()` | contadores de handshake desde o último reset (ou recarga da página): `{ accepted, rejected, refused }`, ou seja, CONNECT aceito, CONNECT_ERROR por sessão inválida/vencida e tentativa recusada durante a queda. Serve para provar que o cliente não repete tentativas sem fim |
| `updateNftSilently({ nftId, price?, availability? })` | **evento perdido:** mesma mudança e validação de `emitNftUpdate` (version +1, REST já responde o novo estado), mas **sem** `nft.updated`. Simula a mudança feita durante uma queda; o app só a descobre reconciliando pelo REST. Devolve o NFT |
| `settleOrderSilently(orderId, status)` | **evento perdido:** liquida um pedido pendente como `emitOrderUpdate`, mas **sem** `order.updated` (nem o `nft.updated` da devolução de estoque). Para segurar o pedido em `pending` até aqui, use antes `configure({ orderSettleMs: <alto> })`. Devolve o pedido |
| `probe({ token? })` | abre uma conexão real com `socket.io-client` e loga no console `connect`, `connect_error`, `disconnect`, tentativas de reconexão e cada evento (validado com o contrato). `token` ausente usa a sessão válida mais recente do store, e `null` conecta como visitante. Devolve a função que fecha |

Eventos de `emitDuplicate`/`emitStale` seguem as mesmas regras de audiência. Eles não alteram o store nem o histórico. As mudanças `*Silently` alteram o store, mas não entram no histórico (não há evento).

```js
const close = window.__mocks.probe()
window.__mocks.emitNftUpdate({ nftId: 'nft_001', price: '1.5' })
window.__mocks.emitDuplicate()
window.__mocks.emitStale()
window.__mocks.disconnectSockets(); setTimeout(() => window.__mocks.reconnectSockets(), 3000)
close()
```

## Limitações do ambiente de mocks

- **Não há servidor.** O "servidor" roda no contexto da página, no mesmo event loop do app. O MSW substitui o `WebSocket` global; nada passa pela rede, e o Service Worker do MSW não participa do WebSocket.
- **Cada aba tem seu próprio servidor.** Conexões, salas e histórico não são compartilhados. O banco é sincronizado entre abas via `localStorage`, mas a mudança feita em uma aba não gera evento nas outras (elas veem o estado novo pelo REST).
- **Um refresh derruba o servidor junto com a página.** Eventos emitidos sem nenhuma conexão aberta (durante uma queda ou entre o refresh e a reconexão) se perdem; não há buffer nem *connection state recovery*. Depois de reconectar, o cliente deve reconciliar os recursos ativos pelo REST.
- **Só transporte `websocket`, sem upgrade e sem long-polling.** É preciso `transports: ['websocket']`.
- **Só o namespace `/`.** Outros namespaces recebem `connect_error`.
- **Só servidor → cliente.** Eventos emitidos pelo cliente (`socket.emit`) e acks são ignorados. O app só escuta.
- **Sem mensagens binárias** (o binding decodifica só texto) **e sem *connection state recovery*** (`socket.recovered` é sempre `false`).
- **Recursos do binding não usados:** ele não implementa salas, namespaces nem broadcast. As salas estão em `socket.ts`, só para a entrega local.
- **Ordem de carregamento do `socket.io-client`:** ver [Como o app deve conectar](#como-o-app-deve-conectar).
- **Versões:** o projeto usa `msw` 3 e o `@mswjs/socket.io-binding` 0.2.0 declara `msw ^2` como peer. A integração usa só a parte compatível do binding (`toSocketIo` e `client.emit`), e o restante do protocolo fica em `socket.ts`.
- **Timers em segundo plano:** o navegador atrasa `setInterval` em abas ocultas. O `pingTimeout` folgado (60 s) evita quedas por isso, mas não as garante contra uma suspensão longa da aba.
