# Kurio — marketplace de NFTs

O Kurio é um marketplace de NFTs: catálogo com busca e filtros, detalhe do NFT, favoritos, carrinho, checkout com carteira simulada, pedidos e perfil. Não há backend real: a API REST é simulada com MSW e o tempo real, com um Socket.IO simulado, ambos no navegador.

Deploy: https://nft-marketplace-delta-ruby.vercel.app

## Pré-requisitos

- Node `>=26` (`engines` do `package.json`).
- pnpm `12.21.0` (`packageManager`: `pnpm@12.21.0`).

## Setup

```bash
pnpm install
pnpm exec playwright install chromium
```

O segundo comando baixa o Chromium usado pelos testes E2E.

## Variáveis de ambiente

- `VITE_ENABLE_MOCKS`: liga o MSW (REST) e o Socket.IO simulado. O valor deve ser exatamente `"true"` (minúsculas). Qualquer outro valor desliga os mocks e o app registra `[mocks] desligados` no Console. Como não há backend, ela é necessária em dev e no build publicado.
- Arquivos `.env` versionados no repositório: `.env.development` (usado por `pnpm dev`), `.env.production` (usado por `pnpm build`) e `.env.example` (modelo). Todos têm `VITE_ENABLE_MOCKS=true`, então dev e build já ligam os mocks num checkout limpo.
- `.env.local` é opcional e não é versionado (o `.gitignore` ignora `*.local`). Use-o só para sobrescrever algo localmente, por exemplo `VITE_ENABLE_MOCKS=false` para desligar os mocks.

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm dev` | Servidor de desenvolvimento do Vite (porta 5173). |
| `pnpm build` | Checa os tipos (`tsc -b`) e gera o build de produção em `dist`. |
| `pnpm preview` | Serve o build de `dist` localmente. |
| `pnpm typecheck` | Checagem de tipos (`tsc -b --noEmit`). |
| `pnpm lint` | ESLint em todo o projeto. |
| `pnpm test:e2e` | Roda todos os testes E2E com Playwright. |
| `pnpm test:e2e:ui` | Testes E2E no modo interativo do Playwright (`--ui`). |
| `pnpm test:e2e:report` | Abre o último relatório HTML do Playwright. |
| `pnpm test:a11y` | Só os testes de acessibilidade (`e2e/a11y.spec.ts`). |
| `pnpm test:visual` | Só os testes de regressão visual (`e2e/visual.spec.ts`). |
| `pnpm test:visual:update` | Regrava os baselines das capturas visuais (`--update-snapshots`). |
| `pnpm lighthouse` | Roda a auditoria Lighthouse (build, preview e 12 medições). |
| `pnpm lighthouse:report` | Mostra o resumo da última auditoria e abre o `RESULTADOS.md`. |

## Credenciais fictícias

Dados de demonstração, de [docs/API.md](docs/API.md). Só existem nos mocks.

| Usuário | E-mail | Senha | Observação |
|---|---|---|---|
| Ana Souza | `ana@example.com` | `ana12345` | usuário `ana_souza`, ENS `ana.eth`, código de indicação `KURIO-ANA26`; carteira principal `Principal` (MetaMask, Ethereum) e secundária `Reserva` (WalletConnect, Polygon); carrinho com 2 itens, 3 favoritos, 1 pedido confirmado |
| Bruno Lima | `bruno@example.com` | `bruno12345` | usuário `bruno_lima`, ENS `bruno.eth`, código de indicação `KURIO-BRUNO26`; carteira principal `Principal` (Coinbase Wallet, Base) e secundária `Sem saldo` (termina em `dead`, recusa pagamentos) |

Cupons:

| Cupom | Efeito |
|---|---|
| `BEMVINDO10` | 10 % de desconto, com teto de 0.5 ETH |
| `MENOS005` | desconto fixo de 0.005 ETH |
| `BLACKFRIDAY25` | expirado |
| `NAOEXISTE` | inexistente |

Os códigos de indicação são fictícios e os endereços de carteira são `0x` + 40 hexadecimais.

## Cenários

Os cenários de rede e falha (offline, erro de servidor, sessão expirada etc.) valem para toda rota REST em `/api` quando `VITE_ENABLE_MOCKS=true`, inclusive no deploy.

- **Por URL:** `?scenario=<nome>` (e, opcionalmente, `&seed=<n>`), por exemplo `/?scenario=offline`. Um nome desconhecido é ignorado, com aviso no Console. O cenário fica salvo no `localStorage` e sobrevive ao refresh.
- **Pelo Console:** `window.__mocks.setScenario('nome', opções?)` ativa o cenário do zero. `window.__mocks.reset()` restaura o seed, as configurações padrão e o cenário `default`. Depois de trocar, recarregue a página (`location.reload()`).

```js
window.__mocks.setScenario('server-error', { failures: 3 }); location.reload()
window.__mocks.listScenarios()   // todos os nomes
window.__mocks.reset()
```

Enquanto `?scenario=` estiver na URL, ele vence o que foi escolhido pelo Console. A lista completa e os detalhes estão em [docs/SCENARIOS.md](docs/SCENARIOS.md).

## Como reproduzir cada falha

Abra o app (dev ou deploy). Onde o passo diz "como Ana", entre antes em `/login` com `ana@example.com` / `ana12345`. Para ir ao checkout: adicione um item ao carrinho, abra o carrinho e avance para o pagamento.

- **`offline`**
  1. Abra `/?scenario=offline`. Toda requisição falha como erro de rede e o catálogo mostra o erro com "Tentar de novo".
  2. No Console, rode `window.__mocks.setScenario('default')` e clique em "Tentar de novo": o catálogo carrega sem recarregar a página.
- **`server-error`**
  1. Abra `/?scenario=server-error`. As duas primeiras chamadas de cada rota respondem 500 e 503, alternando, e o catálogo mostra o erro com "Tentar de novo".
  2. Clique em "Tentar de novo": a terceira chamada responde 200. `setScenario('server-error', { failures: 3 })` muda a quantidade de falhas.
- **`session-expired`**
  1. Abra `/login?scenario=session-expired` e entre como Ana.
  2. Navegue: depois de 5 requisições autenticadas com sucesso (`afterRequests`, padrão 5) o token expira e a próxima resposta é 401. O app leva ao login com "Sua sessão expirou. Entre novamente para continuar."
  3. Entre de novo; a navegação segue normal. Pelo Console, `setScenario('session-expired', { afterRequests: 2 })` antecipa a expiração.
- **`register-conflict`**
  1. Abra `/signup?scenario=register-conflict`.
  2. Preencha o formulário com dados válidos e qualquer e-mail e envie: a API responde 409 e o campo e-mail mostra "E-mail já cadastrado".
- **`coupon-invalid`**
  1. Entre como Ana, abra `/?scenario=coupon-invalid` e vá ao carrinho.
  2. Aplique `BEMVINDO10`: o cupom aparece como "Cupom inválido." e o desconto é 0.
- **`coupon-expired`**
  1. Entre como Ana, abra `/?scenario=coupon-expired` e vá ao carrinho.
  2. Aplique `BEMVINDO10`: o cupom aparece como "Cupom expirado." e o desconto é 0.
- **`price-changed`**
  1. Entre como Ana e abra `/?scenario=price-changed`.
  2. Vá ao checkout, preencha os dados, conecte a carteira, abra a revisão e envie o pedido.
  3. O primeiro envio do cenário sobe 10 % o preço do primeiro item e a API responde 409: o app mostra o antes e o depois, sem criar pedido. Clique em "Confirmar novos valores" para criar o pedido com a nova cotação. Para repetir, rode `window.__mocks.setScenario('price-changed')`.
- **`sold-out`**
  1. Igual a `price-changed`, com `/?scenario=sold-out`.
  2. No primeiro envio, a edição do primeiro item esgota: o app avisa que o item está esgotado, não cria pedido e oferece "Ajustar carrinho".
- **`order-timeout`**
  1. Entre como Ana, abra `/?scenario=order-timeout`, vá ao checkout e envie o pedido.
  2. O servidor cria o pedido, mas a resposta não chega. Depois de 10 s (timeout do envio) a revisão mostra "Verificando seu pedido...".
  3. O app reenvia com a mesma `Idempotency-Key`; a API devolve o mesmo pedido (200, `Idempotent-Replayed: true`) e a tela segue para `/orders/<id>` sem duplicar a compra.
- **`payment-rejected`**
  1. Entre como Ana, abra `/?scenario=payment-rejected` e conclua uma compra com qualquer carteira.
  2. Após cerca de 2,5 s o pedido vira recusado: a tela mostra "Pagamento recusado" com o motivo, e os itens continuam no carrinho. (Sem o cenário, a carteira `Sem saldo` do Bruno, terminada em `dead`, também recusa.)
- **`wallet-rejected`**
  1. Entre como Ana, abra `/?scenario=wallet-rejected` e vá ao checkout.
  2. Em "Conectar carteira", a primeira conexão é recusada (403). Clique em "Tentar de novo": a segunda conecta normalmente.
- **Desconexão do socket**
  1. Abra o app. No Console, rode `window.__mocks.disconnectSockets()`: as conexões caem e novas são recusadas. O indicador de tempo real, no canto da tela, passa a mostrar "Reconectando…" e depois "Sem atualizações em tempo real."
  2. Rode `window.__mocks.reconnectSockets()`: o cliente reconecta na próxima tentativa do backoff (até 5 s) e o indicador volta ao estado quieto. Detalhes em [docs/REALTIME.md](docs/REALTIME.md).

## Estrutura

- `src/features/*`: uma pasta por feature (catalog, cart, checkout, realtime etc.).
- `src/contracts`: schemas Zod das respostas.
- `src/mocks`: único lugar com dados fictícios (MSW e Socket.IO simulado).
- `public/favicon.svg`: ícone da página (um "K" em `#D08B4C` sobre `#140D0A`), criação própria, já que o Figma não traz ícone. Detalhes em [ARCHITECTURE.md](ARCHITECTURE.md#substituições-de-assets).

## Testes

- E2E com Playwright: `pnpm exec playwright test`.
- Os testes sobem o próprio servidor Vite (com mocks) na porta **5199**; o `pnpm dev` continua na 5173. Se a 5199 estiver ocupada, a execução falha com erro de porta em uso.
- **Não rode duas execuções do Playwright ao mesmo tempo**: cada uma apaga `test-results`.
- Acessibilidade e responsividade: `pnpm test:a11y` e `pnpm exec playwright test e2e/responsive.spec.ts`.
- Regressão visual: `pnpm test:visual`. As capturas de referência (baselines) ficam versionadas em `e2e/__screenshots__/<projeto>/visual.spec.ts/`, sem sufixo de plataforma.
  - **Os baselines foram gerados no Windows, com Chromium.** Outro sistema operacional ou outras fontes do sistema podem mudar a renderização (anti-aliasing, hinting) e fazer o teste falhar sem que haja defeito. A tolerância é de no máximo 1% dos pixels (`maxDiffPixelRatio: 0.01`).
  - Para atualizar depois de uma mudança visual intencional: `pnpm test:visual:update`, confira as imagens alteradas no diff do Git e commite junto com a mudança. Rode `pnpm test:visual` duas vezes em seguida para confirmar que está estável.

## Lighthouse

Auditoria da SPEC (seção 10): início (`/`) e detalhe do NFT (`/nft/nft_003`), perfis mobile e desktop, 3 medições por combinação (12 no total) e a **mediana** de cada categoria e métrica.

- Reproduzir: `pnpm lighthouse`. O script ([lighthouse/run.mjs](lighthouse/run.mjs)) roda `pnpm build` com `VITE_ENABLE_MOCKS=true` (cenário default), sobe `pnpm preview --port 4173 --strictPort`, mede em sequência e encerra o servidor. A porta 4173 precisa estar livre: se estiver ocupada, o script aborta sem derrubar nada. Leva alguns minutos; feche outros programas pesados antes.
- Chrome: usa o Chrome instalado. Sem ele, aponte `CHROME_PATH` para o Chromium do Playwright (ex.: `%LOCALAPPDATA%\ms-playwright\chromium-*\chrome-win64\chrome.exe`).
- Cada medição usa um Chrome novo com perfil vazio e `disableStorageReset: false`; há um aquecimento descartado por página/perfil.
- Relatórios: `lighthouse/reports/` (HTML e JSON de cada execução, ex.: `inicio-mobile-run1.html`, versionados), `lighthouse/summary.json` e `lighthouse/RESULTADOS.md` (medianas, comparação com as metas, ambiente, comando e justificativas). `pnpm lighthouse:report` mostra o resumo e abre o RESULTADOS.md.

### Resumo das medianas

| Página | Perfil | Perf. | A11y | Best Pr. | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| `/` | Mobile | 64 | 100 | 100 | 92 | 4888 ms | 0.033 | 722 ms |
| `/` | Desktop | 98 | 100 | 100 | 92 | 1128 ms | 0.029 | 6 ms |
| `/nft/nft_003` | Mobile | 79 | 100 | 100 | 92 | 4898 ms | 0.000 | 201 ms |
| `/nft/nft_003` | Desktop | 98 | 100 | 100 | 92 | 1138 ms | 0.000 | 0 ms |

Só os dois perfis mobile ficam abaixo de 90 em Performance (`/` com 64 e `/nft/nft_003` com 79); os dois desktop passam. Accessibility, Best Practices e SEO atingem as metas (≥ 95, ≥ 95 e ≥ 90) em todas as combinações. Causas e oportunidades em [lighthouse/RESULTADOS.md](lighthouse/RESULTADOS.md). Medição em 2026-11-19, Lighthouse 13.6.0, AMD Ryzen 5 PRO 4650G with Radeon Graphics x12.

## Deploy

Publicação na Vercel (o build usa os mocks e o Socket.IO simulado, sem backend):

1. Importe o repositório na Vercel (**Add New → Project**).
2. Framework Preset: **Vite**.
3. Build Command: `pnpm build`. Output Directory: `dist`.
4. Em Environment Variables, defina `VITE_ENABLE_MOCKS=true` (também está em `.env.production`).
5. Publique. O `vercel.json` reescreve todas as rotas para `/index.html` (acesso direto e F5 em `/nft/...`, `/cart`, `/checkout`, `/profile`) e desativa o cache de `/mockServiceWorker.js`.

URL pública: https://nft-marketplace-delta-ruby.vercel.app

### Problemas comuns

- `VITE_ENABLE_MOCKS` deve ser exatamente `true`, em minúsculas, e cadastrada como variável comum (não como Secret).
- Mudar uma variável na Vercel exige **Redeploy sem cache** (desmarque "Use existing Build Cache"), porque o valor é embutido no build.
- Quando a flag está errada, o app registra no Console `[mocks] desligados` com o valor recebido.
- **Deployment Protection** precisa ficar desligada para o link ser público.

Verificação local do build otimizado:

```bash
pnpm build && pnpm preview --port 4173
E2E_BASE_URL=http://localhost:4173 pnpm exec playwright test e2e/smoke.spec.ts
```

Com `E2E_BASE_URL` definida, o Playwright não sobe o Vite e usa esse servidor.

## Documentação

- [ARCHITECTURE.md](ARCHITECTURE.md): decisões de arquitetura.
- [docs/API.md](docs/API.md): API REST simulada, contratos e dados de demonstração.
- [docs/REALTIME.md](docs/REALTIME.md): eventos em tempo real (Socket.IO simulado) e controles do painel.
- [docs/SCENARIOS.md](docs/SCENARIOS.md): cenários de rede e falha.
