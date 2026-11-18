import { test, expect } from './fixtures'

test('a página inicial abre e mostra o catálogo com 9 NFTs', async ({ page }) => {
  const catalog = page.getByRole('region', { name: 'Catálogo de NFTs' })
  await expect(catalog).toBeVisible()
  // Cada card tem um botão "Adicionar <nome> ao carrinho" (a paginação também é uma lista).
  const cards = catalog.getByRole('listitem').filter({
    has: page.getByRole('button', { name: /^Adicionar .* ao carrinho$/ }),
  })
  await expect(cards).toHaveCount(9)
})
