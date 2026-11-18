interface ImportMetaEnv {
  /** "true" liga a camada de mocks (MSW) em dev e no build de demonstração. */
  readonly VITE_ENABLE_MOCKS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
