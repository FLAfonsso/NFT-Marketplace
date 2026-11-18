# NFT Marketplace

Consulte docs/SPEC.md apenas na seção relevante à tarefa

## Stack
Vite, React, TypeScript, TanStack Router, TanStack Query, Axios,
socket.io-client, Tailwind, shadcn/ui, MSW, Playwright, Zod, decimal.js, pnpm.

## Regras
- Dado fictício só existe em src/mocks. Nunca em componente, hook ou cliente Axios.
- Toda chamada REST passa pelo Axios. Toda resposta é validada com os schemas de src/contracts.
- Valores em ETH são sempre string decimal. Contas com decimal.js. Quantidades são inteiras.
- Tempo real sempre passa pelo socket.io-client. Nunca mexer no cache direto a partir do mock.
- Cache do Query é isolado por usuário e limpo no logout.
- Estrutura por feature em src/features/*.
- Antes de dizer que terminou, rode: pnpm typecheck && pnpm lint