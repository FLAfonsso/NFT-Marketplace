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


test('rota inexistente mostra a página de não encontrado e permite voltar ao início', async ({ page }) => {
  await page.goto('/rota-que-nao-existe')
  await expect(page.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeVisible()
  await expect(page).toHaveTitle(/Página não encontrada/)
  const back = page.getByRole('link', { name: 'Voltar ao início' })
  await expect(back).toHaveAttribute('href', '/')
  await back.click()
  await expect(page).toHaveURL(/\/$/)
})
