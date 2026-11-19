# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

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
| `/` | Mobile | 53 | 100 | 100 | 92 | 5111 ms | 0.033 | 1317 ms |
| `/` | Desktop | 97 | 100 | 100 | 92 | 1271 ms | 0.029 | 42 ms |
| `/nft/nft_003` | Mobile | 57 | 100 | 100 | 92 | 4964 ms | 0.000 | 1293 ms |
| `/nft/nft_003` | Desktop | 89 | 100 | 100 | 92 | 1232 ms | 0.186 | 11 ms |

Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90. Atingidas: Accessibility, Best Practices e SEO em todas as combinações, e Performance em `/` desktop. Abaixo da meta: Performance em `/` mobile (53), `/nft/nft_003` mobile (57) e `/nft/nft_003` desktop (89). Causas e oportunidades em [lighthouse/RESULTADOS.md](lighthouse/RESULTADOS.md). Medição em 2026-11-19, Lighthouse 13.6.0, AMD Ryzen 5 PRO 4650G with Radeon Graphics x12.

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
