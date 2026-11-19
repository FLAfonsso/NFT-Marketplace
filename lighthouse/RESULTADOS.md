# Resultados Lighthouse

Gerado por `lighthouse/run.mjs` em 2026-11-19T06:33:29.174Z. Mediana de 3 medições por página e perfil.

## Medianas

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT | FCP | Speed Index |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` | Mobile | 53 | 100 | 100 | 92 | 5111 ms | 0.033 | 1317 ms | 2356 ms | 3094 ms |
| `/` | Desktop | 97 | 100 | 100 | 92 | 1271 ms | 0.029 | 42 ms | 299 ms | 796 ms |
| `/nft/nft_003` | Mobile | 57 | 100 | 100 | 92 | 4964 ms | 0.000 | 1293 ms | 942 ms | 2657 ms |
| `/nft/nft_003` | Desktop | 89 | 100 | 100 | 92 | 1232 ms | 0.186 | 11 ms | 285 ms | 665 ms |

Scores de 0 a 100; LCP, TBT, FCP e Speed Index em milissegundos; CLS adimensional.

## Metas da SPEC (seção 10)

| Página | Perfil | Categoria | Mediana | Meta | Status |
|---|---|---|---|---|---|
| `/` | Mobile | Performance | 53 | ≥ 90 | ❌ abaixo |
| `/` | Mobile | Accessibility | 100 | ≥ 95 | ✅ atingida |
| `/` | Mobile | Best Practices | 100 | ≥ 95 | ✅ atingida |
| `/` | Mobile | SEO | 92 | ≥ 90 | ✅ atingida |
| `/` | Desktop | Performance | 97 | ≥ 90 | ✅ atingida |
| `/` | Desktop | Accessibility | 100 | ≥ 95 | ✅ atingida |
| `/` | Desktop | Best Practices | 100 | ≥ 95 | ✅ atingida |
| `/` | Desktop | SEO | 92 | ≥ 90 | ✅ atingida |
| `/nft/nft_003` | Mobile | Performance | 57 | ≥ 90 | ❌ abaixo |
| `/nft/nft_003` | Mobile | Accessibility | 100 | ≥ 95 | ✅ atingida |
| `/nft/nft_003` | Mobile | Best Practices | 100 | ≥ 95 | ✅ atingida |
| `/nft/nft_003` | Mobile | SEO | 92 | ≥ 90 | ✅ atingida |
| `/nft/nft_003` | Desktop | Performance | 89 | ≥ 90 | ❌ abaixo |
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
| Data | 2026-11-19T06:33:29.174Z |
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

#### `/` · Mobile · Performance (53 < 90)

Auditorias abaixo de 0,9 na execução 1 (do JSON do relatório):

- `total-blocking-time` (Total Blocking Time): score 0.05, valor: 2,290 ms, peso 30
- `largest-contentful-paint` (Largest Contentful Paint): score 0.27, valor: 5.0 s, peso 25

LCP (execução 1): elemento `<img alt="Emerald Ape #042, arte principal" loading="lazy" class="size-full rounded-2xl object-cover md:rounded-md" src="/assets/Eape.png">`; TTFB 5 ms, espera até iniciar o download 533 ms, download 65 ms, atraso de renderização 1122 ms (`lcp-breakdown-insight`).

#### `/nft/nft_003` · Mobile · Performance (57 < 90)

Auditorias abaixo de 0,9 na execução 1 (do JSON do relatório):

- `total-blocking-time` (Total Blocking Time): score 0.2, valor: 1,230 ms, peso 30
- `largest-contentful-paint` (Largest Contentful Paint): score 0.28, valor: 4.9 s, peso 25

LCP (execução 1): elemento `<img alt="Neon Vessel #552, arte principal" class="size-full object-cover md:rounded-2xl" src="/assets/Nape.png">`; TTFB 6 ms, espera até iniciar o download 742 ms, download 37 ms, atraso de renderização 538 ms (`lcp-breakdown-insight`).

#### `/nft/nft_003` · Desktop · Performance (89 < 90)

Auditorias abaixo de 0,9 na execução 1 (do JSON do relatório):

- `cumulative-layout-shift` (Cumulative Layout Shift): score 0.66, valor: 0.186, peso 25

LCP (execução 1): elemento `<img alt="Neon Vessel #552, arte principal" class="size-full object-cover md:rounded-2xl" src="/assets/Nape.png">`; TTFB 13 ms, espera até iniciar o download 736 ms, download 37 ms, atraso de renderização 364 ms (`lcp-breakdown-insight`).

## Análise

Resumo: Accessibility (100), Best Practices (100) e SEO (92) atingem a meta em todas as combinações. Performance fica abaixo de 90 em três delas (`/` mobile 53, `/nft/nft_003` mobile 57, `/nft/nft_003` desktop 89); `/` desktop atinge (97). Nada foi simplificado para melhorar a nota: as medições carregam MSW, imagens, fontes e todas as funcionalidades.

**Ruído de medição.** Os runs variam bastante no mesmo computador (mobile `/`: TBT de 743 a 2286 ms entre as 3 execuções; Performance de 53 a 59). Na rodada anterior (mesmo código, descartada porque a checagem do MSW estava errada), `/` desktop deu mediana 80 e agora deu 97. Por isso a mediana de 3 é um indicador, não um valor exato; a diferença de 89 para 90 em `/nft/nft_003` desktop está dentro desse ruído para o score, mas o CLS abaixo é reproduzível.

### `/` mobile — Performance 53 (LCP 5111 ms, TBT 1317 ms)

- **TBT (peso 30, score 0,05 na execução 1: 2.290 ms).** Quem ocupa a thread principal é JavaScript: `bootup-time` e `mainthread-work-breakdown` apontam `index-*.js` (333 KB, o bundle do app) e `browser-*.js` (462 KB, o MSW + `@mswjs/socket.io-binding`) como os maiores scripts (cerca de 560–590 ms cada no run 2 sob CPU 4× mais lenta), com 10 long tasks (`long-tasks`). O `browser-*.js` é carregado antes do primeiro render porque `src/main.tsx` aguarda `enableMocking()`; ele só existe por causa dos mocks da entrega. `unused-javascript` estima 122 KiB não usados na carga inicial.
- **LCP (peso 25, score 0,27: 5,0 s).** O elemento é uma imagem do grid (`Eape.png`, `loading="lazy"`, 457 KB). `lcp-discovery-insight`: sem `fetchpriority=high`, imagem não descobrível no HTML inicial (só existe depois de React + `/api/nfts` via MSW) e com `loading=lazy`. No `lcp-breakdown-insight` da execução 1: espera para iniciar o download 533 ms e atraso de renderização 1122 ms; o download em si é curto (65 ms). Ou seja, o LCP é dominado pelo tempo até o JS terminar de subir MSW e renderizar, não pela rede.
- `render-blocking-insight`: o CSS (`index-*.css`, 16 KB) bloqueia a renderização (estimativa de 380 ms no mobile).

### `/nft/nft_003` mobile — Performance 57 (LCP 4964 ms, TBT 1293 ms)

- Mesma causa: TBT de 1.230 ms (score 0,2) com `browser-*.js` (MSW) e `index-*.js` dominando o `bootup-time`.
- LCP 4,9 s (score 0,28): elemento `Nape.png` (454 KB), já com carregamento eager, mas sem `fetchpriority` e descoberto só após o JS (`requestDiscoverable: false`); espera até iniciar o download 742 ms e atraso de renderização 538 ms na execução 1.
- `render-blocking-insight`: CSS com economia estimada de 290 ms.

### `/nft/nft_003` desktop — Performance 89 (CLS 0,186)

- `cumulative-layout-shift` (peso 25, score 0,66, valor 0,186). O `cls-culprits-insight` aponta o `<footer class="hidden … md:block">` deslocado quando o conteúdo do detalhe termina de carregar: o footer é renderizado antes do conteúdo assíncrono e é empurrado para baixo. Só ocorre em desktop (`md:block`); no mobile o CLS é 0.
- LCP (1,2 s) e TBT (11 ms) estão bons nesse perfil.

### Oportunidades que não exigem simplificar o app (fora do escopo desta tarefa, que não altera `src`)

1. **Reservar altura no detalhe do NFT** (ou só montar o footer depois do conteúdo carregar / `min-height` no `<main>`): elimina o CLS 0,186 e leva `/nft/nft_003` desktop a ≥ 90.
2. **Priorizar a imagem do LCP**: `fetchpriority="high"` e `loading="eager"` na primeira imagem do hero/grid da home e do detalhe (`lcp-discovery-insight` reprova os três critérios na home mobile).
3. **Imagens menores**: os `*.png` têm 400–477 KB cada; WebP/AVIF e `srcset` com tamanhos por viewport reduzem bytes e decodificação sem mudar o conteúdo.
4. **Tirar o MSW do caminho crítico do primeiro render quando possível** (por exemplo, renderizar o shell/skeleton antes de `enableMocking()` terminar, mantendo as chamadas `/api` aguardando o worker) e carregar o MSW sem bloquear o parse do bundle principal. Mantém as funcionalidades e reduz FCP/LCP.
5. **Reduzir JS inicial**: `unused-javascript` indica ~122–125 KiB não usados; mais code splitting (rotas e Dialog/CouponForm/checkout, que já aparecem pré-carregados na rede) e dividir `reason-parts` (114 KB).
6. **CSS crítico inline** ou preload do CSS para atacar o `render-blocking-insight` (90–380 ms).
7. **Preload da fonte** `roboto-mono` (a cadeia CSS → woff2 é o caminho mais longo em `network-dependency-tree-insight`: ~2,2 s no mobile em um run da primeira rodada; `font-display-insight` já passa).

Nota sobre condições: o computador não tinha outra carga deliberada, mas é uma máquina de uso normal (Windows 11, sem isolamento de processos em segundo plano), o que explica parte da variação entre execuções.
