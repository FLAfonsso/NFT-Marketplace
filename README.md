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

## Testes

- E2E com Playwright: `pnpm exec playwright test`.
- Os testes sobem o próprio servidor Vite (com mocks) na porta **5199**; o `pnpm dev` continua na 5173. Se a 5199 estiver ocupada, a execução falha com erro de porta em uso.
- **Não rode duas execuções do Playwright ao mesmo tempo**: cada uma apaga `test-results`.
- Acessibilidade e responsividade: `pnpm test:a11y` e `pnpm exec playwright test e2e/responsive.spec.ts`.
- Regressão visual: `pnpm test:visual`. As capturas de referência (baselines) ficam versionadas em `e2e/__screenshots__/<projeto>/visual.spec.ts/`, sem sufixo de plataforma.
  - **Os baselines foram gerados no Windows, com Chromium.** Outro sistema operacional ou outras fontes do sistema podem mudar a renderização (anti-aliasing, hinting) e fazer o teste falhar sem que haja defeito. A tolerância é de no máximo 1% dos pixels (`maxDiffPixelRatio: 0.01`).
  - Para atualizar depois de uma mudança visual intencional: `pnpm test:visual:update`, confira as imagens alteradas no diff do Git e commite junto com a mudança. Rode `pnpm test:visual` duas vezes em seguida para confirmar que está estável.

## Deploy

Publicação na Vercel (o build usa os mocks e o Socket.IO simulado, sem backend):

1. Importe o repositório na Vercel (**Add New → Project**).
2. Framework Preset: **Vite**.
3. Build Command: `pnpm build`. Output Directory: `dist`.
4. Em Environment Variables, defina `VITE_ENABLE_MOCKS=true` (também está em `.env.production`).
5. Publique. O `vercel.json` reescreve todas as rotas para `/index.html` (acesso direto e F5 em `/nft/...`, `/cart`, `/checkout`, `/profile`) e desativa o cache de `/mockServiceWorker.js`.

Verificação local do build otimizado:

```bash
pnpm build && pnpm preview --port 4173
E2E_BASE_URL=http://localhost:4173 pnpm exec playwright test e2e/smoke.spec.ts
```

Com `E2E_BASE_URL` definida, o Playwright não sobe o Vite e usa esse servidor.
