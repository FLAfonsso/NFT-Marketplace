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
