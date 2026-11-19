# Resultados Lighthouse

Gerado por `lighthouse/run.mjs` em 2026-11-19T12:44:23.595Z. Mediana de 3 medições por página e perfil.

## Medianas

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT | FCP | Speed Index |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` | Mobile | 64 | 100 | 100 | 92 | 4888 ms | 0.033 | 722 ms | 931 ms | 2805 ms |
| `/` | Desktop | 98 | 100 | 100 | 92 | 1128 ms | 0.029 | 6 ms | 272 ms | 645 ms |
| `/nft/nft_003` | Mobile | 79 | 100 | 100 | 92 | 4898 ms | 0.000 | 201 ms | 931 ms | 2292 ms |
| `/nft/nft_003` | Desktop | 98 | 100 | 100 | 92 | 1138 ms | 0.000 | 0 ms | 267 ms | 583 ms |

Scores de 0 a 100; LCP, TBT, FCP e Speed Index em milissegundos; CLS adimensional.

## Metas da SPEC (seção 10)

| Página | Perfil | Categoria | Mediana | Meta | Status |
|---|---|---|---|---|---|
| `/` | Mobile | Performance | 64 | ≥ 90 | ❌ abaixo |
| `/` | Mobile | Accessibility | 100 | ≥ 95 | ✅ atingida |
| `/` | Mobile | Best Practices | 100 | ≥ 95 | ✅ atingida |
| `/` | Mobile | SEO | 92 | ≥ 90 | ✅ atingida |
| `/` | Desktop | Performance | 98 | ≥ 90 | ✅ atingida |
| `/` | Desktop | Accessibility | 100 | ≥ 95 | ✅ atingida |
| `/` | Desktop | Best Practices | 100 | ≥ 95 | ✅ atingida |
| `/` | Desktop | SEO | 92 | ≥ 90 | ✅ atingida |
| `/nft/nft_003` | Mobile | Performance | 79 | ≥ 90 | ❌ abaixo |
| `/nft/nft_003` | Mobile | Accessibility | 100 | ≥ 95 | ✅ atingida |
| `/nft/nft_003` | Mobile | Best Practices | 100 | ≥ 95 | ✅ atingida |
| `/nft/nft_003` | Mobile | SEO | 92 | ≥ 90 | ✅ atingida |
| `/nft/nft_003` | Desktop | Performance | 98 | ≥ 90 | ✅ atingida |
| `/nft/nft_003` | Desktop | Accessibility | 100 | ≥ 95 | ✅ atingida |
| `/nft/nft_003` | Desktop | Best Practices | 100 | ≥ 95 | ✅ atingida |
| `/nft/nft_003` | Desktop | SEO | 92 | ≥ 90 | ✅ atingida |

## Ambiente e condições

| Item | Valor |
|---|---|
| Lighthouse | 13.6.0 |
| Chrome/Chromium | Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.0.0 Safari/537.36 |
| Node | v26.13.1 |
| pnpm | 12.21.0 |
| Sistema operacional | Windows_NT 10.0.26300 (win32 x64, Windows 11 Pro) |
| CPU | AMD Ryzen 5 PRO 4650G with Radeon Graphics x12 |
| Memória (os.totalmem) | 15.4 GB |
| Data | 2026-11-19T12:44:23.595Z |
| Comando | `pnpm lighthouse` (= `node lighthouse/run.mjs`) |

Condições: build otimizado (`pnpm build`) servido por `pnpm preview --port 4173 --strictPort`; `VITE_ENABLE_MOCKS=true` com o cenário default dos mocks; porta 4173 verificada como livre antes de começar; computador sem outra carga deliberada durante a execução (veja a nota na análise).

Metodologia:

- Mobile: preset padrão do Lighthouse (emulação de Moto G Power e throttling simulado padrão). Desktop: `desktop-config` do Lighthouse.
- Cada medição usa um Chrome novo, em modo headless, com perfil temporário vazio, e `disableStorageReset: false` (cache e storage limpos antes de cada carga, inclusive o service worker do MSW).
- Antes das 3 medições de cada página/perfil há um aquecimento descartado (não entra nas medianas nem nos relatórios). Decisão: como o Lighthouse limpa o service worker a cada medição, o MSW se registra de novo em toda carga, que é o que um primeiro visitante vê e está incluído na medição. O aquecimento serve só para não cobrar da primeira medição o frio do servidor de preview e do binário do Chrome. Cada execução confere que `/mockServiceWorker.js` respondeu 200 (campo `mswWorkerStatus` em summary.json).
- As execuções são sequenciais, nunca em paralelo.

## Relatórios

- `/` Mobile: [run1](reports/inicio-mobile-run1.html) ([json](reports/inicio-mobile-run1.json)), [run2](reports/inicio-mobile-run2.html) ([json](reports/inicio-mobile-run2.json)), [run3](reports/inicio-mobile-run3.html) ([json](reports/inicio-mobile-run3.json))
- `/` Desktop: [run1](reports/inicio-desktop-run1.html) ([json](reports/inicio-desktop-run1.json)), [run2](reports/inicio-desktop-run2.html) ([json](reports/inicio-desktop-run2.json)), [run3](reports/inicio-desktop-run3.html) ([json](reports/inicio-desktop-run3.json))
- `/nft/nft_003` Mobile: [run1](reports/nft-003-mobile-run1.html) ([json](reports/nft-003-mobile-run1.json)), [run2](reports/nft-003-mobile-run2.html) ([json](reports/nft-003-mobile-run2.json)), [run3](reports/nft-003-mobile-run3.html) ([json](reports/nft-003-mobile-run3.json))
- `/nft/nft_003` Desktop: [run1](reports/nft-003-desktop-run1.html) ([json](reports/nft-003-desktop-run1.json)), [run2](reports/nft-003-desktop-run2.html) ([json](reports/nft-003-desktop-run2.json)), [run3](reports/nft-003-desktop-run3.html) ([json](reports/nft-003-desktop-run3.json))

## Evidências dos resultados abaixo da meta

#### `/` · Mobile · Performance (64 < 90)

Auditorias abaixo de 0,9 na execução 1 (do JSON do relatório):

- `largest-contentful-paint` (Largest Contentful Paint): score 0.29, valor: 4.9 s, peso 25
- `total-blocking-time` (Total Blocking Time): score 0.41, valor: 720 ms, peso 30

LCP (execução 1): elemento `<img alt="Emerald Ape #042, arte principal" loading="eager" fetchpriority="high" class="size-full rounded-2xl object-cover md:rounded-md" src="/assets/Eape.png">`; TTFB 6 ms, espera até iniciar o download 414 ms, download 43 ms, atraso de renderização 883 ms (`lcp-breakdown-insight`).

#### `/nft/nft_003` · Mobile · Performance (79 < 90)

Auditorias abaixo de 0,9 na execução 1 (do JSON do relatório):

- `largest-contentful-paint` (Largest Contentful Paint): score 0.28, valor: 4.9 s, peso 25
- `total-blocking-time` (Total Blocking Time): score 0.89, valor: 200 ms, peso 30

LCP (execução 1): elemento `<img alt="Neon Vessel #552, arte principal" loading="eager" fetchpriority="high" class="size-full object-cover md:rounded-2xl" src="/assets/Nape.png">`; TTFB 5 ms, espera até iniciar o download 605 ms, download 28 ms, atraso de renderização 404 ms (`lcp-breakdown-insight`).

## Análise

Resumo: Accessibility (100), Best Practices (100) e SEO (92) atingem a meta em todas as combinações. Performance fica abaixo de 90 em duas delas (`/` mobile 64 e `/nft/nft_003` mobile 79); `/` desktop (98) e `/nft/nft_003` desktop (98) atingem. Depois das duas otimizações de performance (altura reservada no detalhe desktop; `loading="eager"` e `fetchpriority="high"` nas imagens de LCP), o CLS do detalhe desktop caiu de 0,186 para 0. Nada foi simplificado para melhorar a nota: as medições carregam MSW, imagens, fontes e todas as funcionalidades.

**Ruído de medição.** Os runs variam bastante no mesmo computador (mobile `/`: TBT de 743 a 2286 ms entre as 3 execuções; Performance de 53 a 59). Na rodada anterior (mesmo código, descartada porque a checagem do MSW estava errada), `/` desktop deu mediana 80 e agora deu 97. Por isso a mediana de 3 é um indicador, não um valor exato; parte da melhora de TBT no mobile (1317 → 722 ms em `/`, 1293 → 201 ms no detalhe) vem dessa variação e não só das mudanças, que não mexem em JavaScript. O CLS, ao contrário, é reproduzível.

### `/` mobile — Performance 64 (LCP 4888 ms, TBT 722 ms)

- **TBT (peso 30, score 0,41).** Continua sendo JavaScript: `index-*.js` (app) e `browser-*.js` (MSW + `@mswjs/socket.io-binding`), este último carregado antes do primeiro render porque `src/main.tsx` aguarda `enableMocking()`; ele só existe por causa dos mocks da entrega.
- **LCP (peso 25, score 0,29).** A imagem do LCP agora tem `loading="eager"` e `fetchpriority="high"` (`Eape.png`), mas o tempo quase não mudou: espera para iniciar o download 414 ms, download 43 ms, atraso de renderização 883 ms. A imagem só existe depois de React + `/api/nfts` via MSW, então o gargalo é subir o MSW e renderizar, não a prioridade de rede.
- `render-blocking-insight`: o CSS (`index-*.css`, 16 KB) bloqueia a renderização.

### `/nft/nft_003` mobile — Performance 79 (LCP 4898 ms, TBT 201 ms)

- LCP 4,9 s (score 0,28): `Nape.png` (454 KB), agora com `fetchpriority="high"`; espera até iniciar o download 605 ms e atraso de renderização 404 ms. Mesma causa: a imagem só é descoberta depois do JS e das chamadas via MSW.
- TBT 201 ms (score 0,89) deixou de ser problema nesta rodada, mas veja o ruído de medição acima.

### `/nft/nft_003` desktop — Performance 98 (CLS 0)

- Antes: CLS 0,186, o `<footer>` (`md:block`) descia quando o conteúdo assíncrono chegava. Agora o skeleton desktop reserva a altura final do detalhe e o carrossel "Mais desta coleção" tem altura mínima reservada, então o rodapé não se move (trace de layout shift local: 0,0001, só o header).
- LCP 1,1 s e TBT 0 ms.

### Oportunidades restantes que não exigem simplificar o app

1. **Imagens menores**: os `*.png` têm 400–477 KB cada; WebP/AVIF e `srcset` com tamanhos por viewport reduzem bytes e decodificação sem mudar o conteúdo.
2. **Tirar o MSW do caminho crítico do primeiro render quando possível** (por exemplo, renderizar o shell/skeleton antes de `enableMocking()` terminar, mantendo as chamadas `/api` aguardando o worker) e carregar o MSW sem bloquear o parse do bundle principal. Mantém as funcionalidades e reduz FCP/LCP.
3. **Reduzir JS inicial**: `unused-javascript` indica ~122–125 KiB não usados; mais code splitting (rotas e Dialog/CouponForm/checkout, que já aparecem pré-carregados na rede) e dividir `reason-parts` (114 KB).
4. **CSS crítico inline** ou preload do CSS para atacar o `render-blocking-insight` (90–380 ms).
5. **Preload da fonte** `roboto-mono` (a cadeia CSS → woff2 é o caminho mais longo em `network-dependency-tree-insight`: ~2,2 s no mobile em um run da primeira rodada; `font-display-insight` já passa).

Nota sobre condições: o computador não tinha outra carga deliberada, mas é uma máquina de uso normal (Windows 11, sem isolamento de processos em segundo plano), o que explica parte da variação entre execuções.
