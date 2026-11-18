# Tokens de design (Kurio)

Valores estimados dos prints. Confirmar no Figma e corrigir aqui.

## Cores

| Token             | Valor   | Uso                              |
| ----------------- | ------- | -------------------------------- |
| background        | #140D0A | fundo da página                  |
| surface           | #211512 | cards, sidebar, modais, inputs   |
| surface-strong    | #3A2314 | faixa do rodapé                  |
| border            | #3D2A1D | contornos finos                  |
| accent            | #D08B4C | botões, preços, links, aba ativa |
| accent-foreground | #1A100B | texto sobre botão laranja        |
| foreground        | #F4EEE6 | títulos e texto principal        |
| muted-foreground  | #C8A57C | texto secundário (tom areia)     |
| placeholder       | #9C7E5C | placeholders (checar contraste)  |
| required          | #E8734A | asterisco de campo obrigatório   |

## Tipografia

Fonte monoespaçada em todo o site (parece Roboto Mono; confirmar).
Auto-hospedar com @fontsource, sem CDN.
Estilos do Figma: Display, Heading, Title, Body Large, Body, Caption, Tiny.

- Display: ~48px desktop, ~28px mobile, caixa alta, bold
- Heading: ~24px bold
- Title: ~18px bold
- Body: ~14-16px regular
- Caption: ~12-13px
- Tiny: ~10-11px

## Forma

- Desktop: botões e inputs com raio ~4px; cards e modais ~8px; contornos de 1px.
- Mobile: cards ~24px, botões em pílula, botão primário com gradiente leve (#D08B4C para #B27A47).

## Componentes

- Botão primário: fundo accent, texto escuro, caixa alta nos CTAs.
- Botão secundário: contorno accent (Favoritar, Continuar com Google).
- Stepper de quantidade: botões redondos accent com - e +.
- Chip de edição: pílula com contorno; selecionado com contorno accent.
- Badge RARO: bloco accent no canto superior esquerdo da imagem.
- Preço antigo riscado ao lado do preço atual.
- Abas: sublinhado accent na ativa.
- Paginação: quadrados; página atual preenchida em accent.
- Skeleton: cor surface com shimmer; sem animação se prefers-reduced-motion.
- Logo: texto "KURIO" (camada de texto no Figma), fonte mono bold, caixa alta,
  letter-spacing ~0.1em, ~14px no header e ~28px na tela mobile de login.
  Implementar como texto (componente Logo), sem imagem. É um link para "/".,


## Formato de ETH

Valor sempre string decimal. Exibir com ponto, mínimo 2 casas, sem zeros à direita
além disso (26.83, 0.016, 26.846). Contas com decimal.js. Mesmo formato em todo o app.
