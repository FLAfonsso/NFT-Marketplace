# Arquitetura

## Substituições de assets

### Ícone da página

O Figma não traz ícone de página (favicon). O logo KURIO do design é texto e foi implementado como texto, não como imagem.

Por isso `public/favicon.svg` é criação própria: um "K" em `#D08B4C` sobre fundo `#140D0A`. O `public/apple-touch-icon.png` é a versão em PNG do mesmo ícone, para iOS.

### Meta tags

Adicionadas em `index.html`:

- `<link rel="icon" type="image/svg+xml" href="/favicon.svg">`
- `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`
- `theme-color` (`#140D0A`)
- `description`
- `og:title`, `og:description` e `og:type`
- `<title>`: "Kurio | Marketplace de NFTs"
