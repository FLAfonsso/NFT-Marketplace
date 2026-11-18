/**
 * Destino de volta após o login. Só caminhos internos ("/x"), nunca outra origem
 * ("//evil.com", "https://..."), nem as próprias telas de entrada.
 */
export function safeRedirect(value: string | undefined, fallback = '/') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback
  }
  const path = value.split(/[?#]/, 1)[0]
  if (path === '/login' || path === '/signup') return fallback
  return value
}
