import { CATALOG_ANCHOR } from '@/components/layout/content'

/**
 * Leva o início do catálogo à tela (troca de página). O comportamento suave ou imediato vem do
 * CSS (`scroll-behavior` só sem prefers-reduced-motion), então aqui não há opção.
 */
export const scrollToCatalog = () => {
  document.getElementById(CATALOG_ANCHOR)?.scrollIntoView()
}
