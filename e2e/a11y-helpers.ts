import type { Locator, Page } from '@playwright/test'
import { expect } from './fixtures'

/**
 * Helpers dos testes de acessibilidade (a11y.spec.ts). Sem sleeps: tudo espera por estado
 * observável (foco, atributos, visibilidade).
 */

// ---------------------------------------------------------------------------
// Indicador de foco
// ---------------------------------------------------------------------------

export type FocusIndicator = {
  ok: boolean
  /** Qual mecanismo foi aceito (ou por que nenhum serviu). */
  detail: string
  /** Contraste do indicador contra o fundo efetivo (WCAG, 1.4.11 pede >= 3). */
  contrast: number
}

/**
 * Roda dentro da página, sobre o elemento que está com foco. Aceita como indicador visível:
 * - outline (estilo != none, largura > 0, cor opaca o bastante);
 * - box-shadow (como o `ring` do Tailwind) com alguma extensão visível;
 * - borda com cor diferente da borda padrão do tema (campos de formulário trocam a cor).
 * O contraste é calculado contra o fundo efetivo (camadas translúcidas dos ancestrais
 * compostas sobre o fundo da página) e precisa ser >= 3.
 * Função autocontida: o Playwright a serializa para o navegador.
 */
export function readFocusIndicator(el: Element): FocusIndicator {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const rgba = (color: string): [number, number, number, number] => {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = '#000'
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    return [r, g, b, a / 255]
  }
  const over = (top: number[], bottom: number[]): [number, number, number] => {
    const a = top[3]
    return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)) as [number, number, number]
  }
  const luminance = ([r, g, b]: number[]) => {
    const lin = (v: number) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  }
  const ratio = (a: number[], b: number[]) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }

  // Fundo efetivo atrás do indicador: do pai do elemento até o html, compondo as camadas
  // translúcidas de baixo para cima (o anel é desenhado fora do próprio elemento).
  const backgroundBehind = (node: Element): [number, number, number] => {
    const layers: [number, number, number, number][] = []
    for (let up: Element | null = node.parentElement; up; up = up.parentElement) {
      layers.push(rgba(getComputedStyle(up).backgroundColor))
    }
    let result = rgba(getComputedStyle(document.body).backgroundColor).slice(0, 3) as [number, number, number]
    for (const layer of layers.reverse()) if (layer[3] > 0) result = over(layer, result)
    return result
  }

  const candidates: { detail: string; contrast: number }[] = []
  const themeBorder = rgba(getComputedStyle(document.documentElement).getPropertyValue('--border'))

  // Controle visualmente oculto (input sr-only dentro de um rótulo ou de um "thumb"): o anel
  // aparece no ancestral próximo, que reage ao foco do filho (has-focus-visible).
  const box = el.getBoundingClientRect()
  const own = getComputedStyle(el)
  const targets: Element[] = [el]
  if (box.width <= 2 || box.height <= 2 || own.clipPath !== 'none' || own.opacity === '0') {
    for (let up = el.parentElement, n = 0; up && n < 3; up = up.parentElement, n++) targets.push(up)
  }

  for (const target of targets) {
    const cs = getComputedStyle(target)
    const background = backgroundBehind(target)

    if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) {
      const color = rgba(cs.outlineColor)
      if (color[3] > 0) {
        candidates.push({
          detail: `outline ${cs.outlineWidth} ${cs.outlineColor}`,
          contrast: ratio(over(color, background), background),
        })
      }
    }

    // box-shadow: separa as sombras por vírgula fora de parênteses.
    const shadows: string[] = []
    let depth = 0
    let current = ''
    for (const char of cs.boxShadow === 'none' ? '' : cs.boxShadow) {
      if (char === '(') depth++
      if (char === ')') depth--
      if (char === ',' && depth === 0) {
        shadows.push(current.trim())
        current = ''
      } else current += char
    }
    if (current.trim()) shadows.push(current.trim())
    for (const shadow of shadows) {
      const lengths = (shadow.match(/-?\d*\.?\d+px/g) ?? []).map(parseFloat)
      const color = rgba(shadow.replace(/-?\d*\.?\d+px/g, '').replace('inset', '').trim())
      if (lengths.some((n) => n !== 0) && color[3] > 0) {
        candidates.push({
          detail: `box-shadow ${shadow}`,
          contrast: ratio(over(color, background), background),
        })
      }
    }

    const border = rgba(cs.borderTopColor)
    if (parseFloat(cs.borderTopWidth) > 0 && border[3] > 0 && ratio(border, themeBorder) > 1.5) {
      candidates.push({
        detail: `borda ${cs.borderTopColor}`,
        contrast: ratio(over(border, background), background),
      })
    }
  }

  if (candidates.length === 0) return { ok: false, detail: 'sem outline, box-shadow nem borda de foco', contrast: 0 }
  const best = candidates.sort((a, b) => b.contrast - a.contrast)[0]
  return { ok: best.contrast >= 3, detail: best.detail, contrast: Math.round(best.contrast * 100) / 100 }
}

export const focusIndicatorOf = (locator: Locator) => locator.evaluate(readFocusIndicator)

export type Stop = { index: number; label: string } & FocusIndicator

/**
 * Percorre a página com Tab. Em cada parada marca o elemento (data-a11y-stop) e mede o
 * indicador de foco. Termina em `until` (elemento que recebeu foco) ou depois de `max` Tabs.
 */
export async function tabThrough(page: Page, { max, until }: { max: number; until?: Locator }) {
  const stops: Stop[] = []
  for (let index = 1; index <= max; index++) {
    await page.keyboard.press('Tab')
    const handle = await page.evaluateHandle(() => document.activeElement as Element)
    const label = await handle.evaluate((el, n) => {
      el.setAttribute('data-a11y-stop', String(n))
      const text =
        el.getAttribute('aria-label') ||
        (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40) ||
        el.tagName.toLowerCase()
      return `${el.tagName.toLowerCase()} "${text}"`
    }, index)
    // As cores do foco entram com transição (transition-colors): mede só depois de assentar.
    await handle.evaluate(async () => {
      const finite = document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
      await Promise.all(finite.map((a) => a.finished.catch(() => undefined)))
    })
    stops.push({ index, label, ...(await handle.evaluate(readFocusIndicator)) })
    await handle.dispose()
    if (until && (await until.evaluateAll((els) => els.some((el) => el === document.activeElement)))) break
  }
  return stops
}

/** O elemento recebeu foco em alguma parada de `tabThrough` (foi marcado com data-a11y-stop). */
export const wasReached = async (locator: Locator) =>
  (await locator.first().getAttribute('data-a11y-stop')) !== null

// ---------------------------------------------------------------------------
// Diálogos e drawers
// ---------------------------------------------------------------------------

const insideDialog = (dialog: Locator) =>
  dialog.evaluate((el) => el.contains(document.activeElement))

/**
 * Comportamento de um diálogo modal: foco entra, Tab e Shift+Tab ficam presos, o fundo fica
 * inerte, Esc fecha e o foco volta ao elemento que abriu. `open` deve abrir pelo teclado a
 * partir do `trigger` (já com foco).
 */
export async function expectModalBehavior(
  page: Page,
  { trigger, dialog, open }: { trigger: Locator; dialog: Locator; open: () => Promise<void> },
) {
  await trigger.focus()
  await expect(trigger).toBeFocused()
  await open()
  await expect(dialog).toBeVisible()

  // Foco vai para dentro ao abrir.
  await expect.poll(() => insideDialog(dialog)).toBe(true)

  // Fundo inerte: o conteúdo principal está sob aria-hidden ou inert.
  const background = await page.evaluate(() => {
    const main = document.querySelector('main')
    return !!main?.closest('[inert], [aria-hidden="true"]')
  })
  expect(background, 'o <main> deveria estar inerte (inert ou aria-hidden) com o diálogo aberto').toBe(true)

  // Tab e Shift+Tab ficam presos (mais voltas do que controles focáveis).
  const focusables = await dialog
    .locator('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')
    .count()
  const turns = Math.min(focusables + 3, 30)
  // O foco passa por "guardas" de foco do componente, que o devolvem ao diálogo: por isso o
  // retorno para dentro é esperado (poll), e o que se prova é que ele nunca fica fora.
  for (let i = 0; i < turns; i++) {
    await page.keyboard.press('Tab')
    await expect.poll(() => insideDialog(dialog), { message: `Tab ${i + 1} saiu do diálogo` }).toBe(true)
  }
  for (let i = 0; i < turns; i++) {
    await page.keyboard.press('Shift+Tab')
    await expect.poll(() => insideDialog(dialog), { message: `Shift+Tab ${i + 1} saiu do diálogo` }).toBe(true)
  }

  // Esc fecha e o foco volta a quem abriu.
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
}

// ---------------------------------------------------------------------------
// Formulários
// ---------------------------------------------------------------------------

/** Todo controle visível do escopo tem nome acessível não vazio. */
export async function expectNamedControls(scope: Locator) {
  const controls = scope.locator(
    'input:visible:not([type=hidden]):not([type=file]):not([aria-hidden=true]), select:visible, textarea:visible',
  )
  const count = await controls.count()
  expect(count, 'nenhum campo encontrado').toBeGreaterThan(0)
  for (let i = 0; i < count; i++) {
    await expect(controls.nth(i)).toHaveAccessibleName(/\S/)
  }
}

/** Campo inválido: aria-invalid, aria-describedby apontando para elementos existentes com texto. */
export async function expectDescribedError(field: Locator) {
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  const message = await field.evaluate((el) => {
    const ids = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
    const texts = ids.map((id) => document.getElementById(id)?.textContent?.trim() ?? null)
    return { ids, missing: ids.filter((_, i) => texts[i] === null), text: texts.filter(Boolean).join(' ') }
  })
  expect(message.ids.length, 'aria-describedby ausente').toBeGreaterThan(0)
  expect(message.missing, 'aria-describedby aponta para id inexistente').toEqual([])
  expect(message.text.length, 'mensagem de erro vazia').toBeGreaterThan(0)
  return message.text
}

/** Obrigatório indicado além da cor: aria-required (o asterisco visual é aria-hidden). */
export async function expectRequiredMarked(field: Locator) {
  const marked = await field.evaluate(
    (el) => el.getAttribute('aria-required') === 'true' || (el as HTMLInputElement).required,
  )
  expect(marked, 'campo obrigatório sem aria-required/required').toBe(true)
}

// ---------------------------------------------------------------------------
// Imagens
// ---------------------------------------------------------------------------

export type ImageReport = { src: string; alt: string | null; informative: boolean; problem?: string }

/**
 * Examina toda <img> renderizada. Regras:
 * - todas têm o atributo alt;
 * - imagem de NFT (assets do catálogo/galeria) e avatar têm alt significativo (não vazio, não nome
 *   de arquivo nem "imagem");
 * - alt="" só vale para decorativas: nunca para imagem que é o único conteúdo de um link/botão.
 */
export const auditImages = (page: Page): Promise<ImageReport[]> =>
  page.evaluate(() => {
    const out: { src: string; alt: string | null; informative: boolean; problem?: string }[] = []
    const generic = /^(image|imagem|img|foto|picture|avatar)?\s*\d*$/i
    for (const img of document.querySelectorAll('img')) {
      const rect = img.getBoundingClientRect()
      if (getComputedStyle(img).display === 'none' || rect.width === 0 || img.closest('[hidden]')) continue
      const src = img.getAttribute('src') ?? ''
      const alt = img.getAttribute('alt')
      const nft = /\/assets\//.test(src)
      const holder = img.closest('a, button')
      const onlyContent = !!holder && !(holder.textContent ?? '').trim() && !holder.getAttribute('aria-label')
      const informative = nft || onlyContent
      let problem: string | undefined
      if (alt === null) problem = 'sem atributo alt'
      else if (informative && alt.trim() === '') problem = 'imagem informativa com alt vazio'
      else if (alt !== '' && (generic.test(alt.trim()) || /\.(png|jpe?g|webp|svg|gif)$/i.test(alt)))
        problem = `alt sem significado: "${alt}"`
      out.push({ src, alt, informative, problem })
    }
    return out
  })

export async function expectImagesAccessible(page: Page, where: string) {
  // Espera alguma imagem renderizada (há <img> escondidas por breakpoint).
  await expect.poll(() => page.locator('img:visible').count()).toBeGreaterThan(0)
  const report = await auditImages(page)
  expect(report.length, `${where}: nenhuma imagem examinada`).toBeGreaterThan(0)
  const problems = report.filter((r) => r.problem)
  expect(problems, `${where}: imagens com problema`).toEqual([])
  return report
}

// ---------------------------------------------------------------------------
// Dados dos mocks
// ---------------------------------------------------------------------------

type ApiNftLite = { id: string; name: string; editions: { id: string; name: string; available: number }[] }

export const apiNfts = (page: Page): Promise<ApiNftLite[]> =>
  page.evaluate(async () => {
    const response = await fetch('/api/nfts?pageSize=48')
    return ((await response.json()) as { items: ApiNftLite[] }).items
  })
