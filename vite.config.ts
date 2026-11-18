import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  // Porta fixa: o Playwright depende dela; falha em vez de pular para outra porta.
  server: { port: 5173, strictPort: true },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});