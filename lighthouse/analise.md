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
