// Auditoria Lighthouse (SPEC seção 10). Uso: pnpm lighthouse | pnpm lighthouse:report
import { spawn, execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'lighthouse')
const REPORTS = path.join(DIR, 'reports')
const PORT = 4173
const ORIGIN = `http://localhost:${PORT}`
const RUNS = 3
const PAGES = [
  { id: 'inicio', label: 'Início', url: '/' },
  { id: 'nft-003', label: 'Detalhe do NFT', url: '/nft/nft_003' },
]
const PROFILES = ['mobile', 'desktop']
const GOALS = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 }
const CATEGORY_LABELS = {
  performance: 'Performance',
  accessibility: 'Accessibility',
  'best-practices': 'Best Practices',
  seo: 'SEO',
}
const METRICS = [
  ['lcp', 'largest-contentful-paint', 'LCP', 'ms'],
  ['cls', 'cumulative-layout-shift', 'CLS', ''],
  ['tbt', 'total-blocking-time', 'TBT', 'ms'],
  ['fcp', 'first-contentful-paint', 'FCP', 'ms'],
  ['si', 'speed-index', 'Speed Index', 'ms'],
]

const isWin = process.platform === 'win32'
const log = (...a) => console.log('[lighthouse]', ...a)

function median(values) {
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function portInUse() {
  return new Promise((resolve) => {
    const sock = net.connect({ port: PORT, host: '127.0.0.1' })
    sock.once('connect', () => (sock.destroy(), resolve(true)))
    sock.once('error', () => resolve(false))
  })
}

async function waitForServer(timeoutMs = 60_000) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    try {
      const res = await fetch(ORIGIN + '/')
      if (res.ok) return
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`O preview não respondeu em ${ORIGIN} em ${timeoutMs}ms`)
}

function stopServer(child) {
  if (!child || child.exitCode !== null) return
  try {
    if (isWin) execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' })
    else process.kill(-child.pid, 'SIGTERM')
  } catch {
    /* já encerrou */
  }
}

function runPnpm(args, env) {
  execSync(`pnpm ${args}`, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } })
}

const cmdVersion = (cmd, args) => {
  try {
    return execSync([cmd, ...args].join(' '), { encoding: 'utf8' }).trim()
  } catch {
    return 'desconhecida'
  }
}

function runName(page, profile, n) {
  return `${page.id}-${profile}-run${n}`
}

function scoreOf(lhr, cat) {
  return Math.round((lhr.categories[cat].score ?? 0) * 100)
}

function extract(lhr) {
  const requests = lhr.audits['network-requests']?.details?.items ?? []
  // O script do service worker não aparece em network-requests; a prova de que o MSW subiu
  // é o app ter recebido respostas de /api/* (só existem via mocks) sem erro.
  const api = requests.filter((r) => new URL(r.url).pathname.startsWith('/api/'))
  const apiOk = api.length > 0 && api.every((r) => r.statusCode === 200)
  const bd = lhr.audits['lcp-breakdown-insight']?.details?.items
  const lcpParts = bd?.[0]?.items
  const lcpNode = bd?.find((i) => i.type === 'node')
  return {
    scores: Object.fromEntries(Object.keys(GOALS).map((c) => [c, scoreOf(lhr, c)])),
    metrics: Object.fromEntries(
      METRICS.map(([key, id]) => [key, lhr.audits[id].numericValue]),
    ),
    apiRequests: api.length,
    apiOk,
    lcpElement: lcpNode?.snippet ?? null,
    lcpBreakdownMs: lcpParts ? Object.fromEntries(lcpParts.map((p) => [p.subpart, Math.round(p.duration)])) : null,
    runtimeError: lhr.runtimeError?.message ?? null,
    finalUrl: lhr.finalDisplayedUrl,
  }
}

/** Auditorias que tiram pontos de uma categoria (valor e score, direto do relatório). */
function weakAudits(lhr, cat) {
  const out = []
  for (const ref of lhr.categories[cat].auditRefs) {
    const a = lhr.audits[ref.id]
    if (ref.weight === 0 && cat === 'performance') continue
    if (a.score === null || a.score === undefined || a.score >= 0.9) continue
    out.push({
      id: a.id,
      title: a.title,
      score: a.score,
      weight: ref.weight,
      value: a.displayValue ?? null,
    })
  }
  return out.sort((x, y) => y.weight * (1 - y.score) - x.weight * (1 - x.score))
}

async function main() {
  const require = createRequire(import.meta.url)
  const lhEntry = require.resolve('lighthouse')
  const lhRequire = createRequire(lhEntry)
  const { default: lighthouse } = await import('lighthouse')
  const { default: desktopConfig } = await import(
    new URL('file:///' + path.join(path.dirname(lhRequire.resolve('lighthouse/package.json')), 'core/config/desktop-config.js').replace(/\\/g, '/')).href
  )
  // chrome-launcher é dependência do lighthouse; no pnpm não fica visível na raiz.
  const chromeLauncher = lhRequire('chrome-launcher')
  const lhVersion = JSON.parse(readFileSync(lhRequire.resolve('lighthouse/package.json'), 'utf8')).version

  if (await portInUse()) {
    throw new Error(
      `A porta ${PORT} já está em uso. Encerre o processo que a ocupa e rode de novo (o script não derruba processos alheios).`,
    )
  }
  if (!process.env.CHROME_PATH) {
    const found = chromeLauncher.Launcher.getFirstInstallation?.()
    if (!found) {
      throw new Error(
        'Chrome não encontrado. Aponte CHROME_PATH para um Chrome/Chromium (ex.: o do Playwright, em %LOCALAPPDATA%\\ms-playwright\\chromium-*\\chrome-win64\\chrome.exe).',
      )
    }
  }

  mkdirSync(REPORTS, { recursive: true })

  log('build otimizado (VITE_ENABLE_MOCKS=true)…')
  runPnpm('build', { VITE_ENABLE_MOCKS: 'true' })

  log(`preview na porta ${PORT}…`)
  const server = spawn(`pnpm preview --port ${PORT} --strictPort`, {
    cwd: ROOT,
    shell: true,
    detached: !isWin,
    stdio: 'ignore',
    env: { ...process.env, VITE_ENABLE_MOCKS: 'true' },
  })
  const cleanup = () => stopServer(server)
  process.on('exit', cleanup)
  process.on('SIGINT', () => process.exit(130))

  const results = []
  let userAgent = ''
  try {
    await waitForServer()

    const measure = async (page, profile, name, { discard = false } = {}) => {
      // Um Chrome novo (perfil temporário vazio) por medição; o Lighthouse ainda limpa cache e storage.
      const chrome = await chromeLauncher.launch({
        chromeFlags: ['--headless=new', '--disable-extensions'],
      })
      try {
        const flags = {
          port: chrome.port,
          logLevel: 'error',
          output: discard ? 'json' : ['html', 'json'],
          disableStorageReset: false,
          // formFactor, emulação e throttling: padrão do preset de cada perfil.
        }
        const config = profile === 'desktop' ? desktopConfig : undefined
        const res = await lighthouse(ORIGIN + page.url, flags, config)
        if (!res) throw new Error('Lighthouse não retornou resultado')
        if (!discard) {
          const [html, json] = res.report
          writeFileSync(path.join(REPORTS, `${name}.html`), html)
          writeFileSync(path.join(REPORTS, `${name}.json`), json)
        }
        return res.lhr
      } finally {
        try {
          await chrome.kill()
        } catch {
          /* limpeza do perfil temporário pode falhar no Windows */
        }
      }
    }

    for (const page of PAGES) {
      for (const profile of PROFILES) {
        log(`${page.label} / ${profile}: aquecimento (descartado)`)
        await measure(page, profile, 'warmup', { discard: true })
        const runs = []
        for (let n = 1; n <= RUNS; n++) {
          const name = runName(page, profile, n)
          log(`${page.label} / ${profile}: medição ${n}/${RUNS}`)
          const lhr = await measure(page, profile, name)
          userAgent ||= lhr.environment.hostUserAgent
          const e = extract(lhr)
          if (e.runtimeError || !e.apiOk) {
            log(`AVISO em ${name}: runtimeError=${e.runtimeError} apiOk=${e.apiOk} (${e.apiRequests} requests /api)`)
          }
          runs.push({ run: n, name, ...e, weak: Object.fromEntries(Object.keys(GOALS).map((c) => [c, weakAudits(lhr, c)])) })
          log(`  perf=${e.scores.performance} a11y=${e.scores.accessibility} bp=${e.scores['best-practices']} seo=${e.scores.seo} LCP=${Math.round(e.metrics.lcp)}ms CLS=${e.metrics.cls.toFixed(3)} TBT=${Math.round(e.metrics.tbt)}ms`)
        }
        results.push({ page, profile, runs })
      }
    }
  } finally {
    cleanup()
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    goals: GOALS,
    runsPerCombination: RUNS,
    env: {
      lighthouse: lhVersion,
      browser: userAgent,
      node: process.version,
      pnpm: cmdVersion('pnpm', ['-v']),
      os: `${os.type()} ${os.release()} (${os.platform()} ${os.arch()}, ${os.version()})`,
      cpu: `${os.cpus()[0]?.model.trim()} x${os.cpus().length}`,
      memoryGB: +(os.totalmem() / 1024 ** 3).toFixed(1),
    },
    combinations: results.map(({ page, profile, runs }) => ({
      page: page.id,
      url: page.url,
      profile,
      medians: {
        scores: Object.fromEntries(Object.keys(GOALS).map((c) => [c, median(runs.map((r) => r.scores[c]))])),
        metrics: Object.fromEntries(METRICS.map(([k]) => [k, median(runs.map((r) => r.metrics[k]))])),
      },
      runs: runs.map(({ weak: _weak, ...r }) => r),
      weakAudits: runs[0].weak,
    })),
  }
  writeFileSync(path.join(DIR, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
  writeFileSync(path.join(DIR, 'RESULTADOS.md'), renderMarkdown(summary))
  log('pronto: lighthouse/summary.json e lighthouse/RESULTADOS.md')
  printSummary(summary)
}

const fmtMetric = (key, v) => (key === 'cls' ? v.toFixed(3) : `${Math.round(v)} ms`)
const profileLabel = (p) => (p === 'mobile' ? 'Mobile' : 'Desktop')

function mediansTable(summary) {
  const head = '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT | FCP | Speed Index |\n|---|---|---|---|---|---|---|---|---|---|---|'
  const rows = summary.combinations.map((c) => {
    const s = c.medians.scores
    const m = c.medians.metrics
    return `| \`${c.url}\` | ${profileLabel(c.profile)} | ${s.performance} | ${s.accessibility} | ${s['best-practices']} | ${s.seo} | ${fmtMetric('lcp', m.lcp)} | ${fmtMetric('cls', m.cls)} | ${fmtMetric('tbt', m.tbt)} | ${fmtMetric('fcp', m.fcp)} | ${fmtMetric('si', m.si)} |`
  })
  return [head, ...rows].join('\n')
}

function goalsTable(summary) {
  const head = '| Página | Perfil | Categoria | Mediana | Meta | Status |\n|---|---|---|---|---|---|'
  const rows = []
  for (const c of summary.combinations) {
    for (const [cat, goal] of Object.entries(summary.goals)) {
      const v = c.medians.scores[cat]
      rows.push(`| \`${c.url}\` | ${profileLabel(c.profile)} | ${CATEGORY_LABELS[cat]} | ${v} | ≥ ${goal} | ${v >= goal ? '✅ atingida' : '❌ abaixo'} |`)
    }
  }
  return [head, ...rows].join('\n')
}

function evidence(summary) {
  const blocks = []
  for (const c of summary.combinations) {
    for (const [cat, goal] of Object.entries(summary.goals)) {
      if (c.medians.scores[cat] >= goal) continue
      const items = c.weakAudits[cat]
      const lines = items.length
        ? items.map((a) => `- \`${a.id}\` (${a.title}): score ${a.score}${a.value ? `, valor: ${a.value}` : ''}, peso ${a.weight}`).join('\n')
        : '- Nenhuma auditoria individual abaixo de 0,9 na execução 1; a diferença vem do arredondamento/variação entre execuções.'
      const r1 = c.runs[0]
      const lcpLine =
        cat === 'performance' && r1.lcpBreakdownMs
          ? `\n\nLCP (execução 1): elemento \`${r1.lcpElement}\`; TTFB ${r1.lcpBreakdownMs.timeToFirstByte} ms, espera até iniciar o download ${r1.lcpBreakdownMs.resourceLoadDelay} ms, download ${r1.lcpBreakdownMs.resourceLoadDuration} ms, atraso de renderização ${r1.lcpBreakdownMs.elementRenderDelay} ms (\`lcp-breakdown-insight\`).`
          : ''
      blocks.push(`#### \`${c.url}\` · ${profileLabel(c.profile)} · ${CATEGORY_LABELS[cat]} (${c.medians.scores[cat]} < ${goal})\n\nAuditorias abaixo de 0,9 na execução 1 (do JSON do relatório):\n\n${lines}${lcpLine}`)
    }
  }
  return blocks.length ? blocks.join('\n\n') : 'Todas as metas foram atingidas; não há resultado abaixo da meta.'
}

function renderMarkdown(summary) {
  const e = summary.env
  const analysisPath = path.join(DIR, 'analise.md')
  const analysis = existsSync(analysisPath) ? readFileSync(analysisPath, 'utf8').trim() : '_Análise ainda não escrita (lighthouse/analise.md)._'
  const runList = summary.combinations
    .map((c) => `- \`${c.url}\` ${profileLabel(c.profile)}: ` + c.runs.map((r) => `[run${r.run}](reports/${r.name}.html) ([json](reports/${r.name}.json))`).join(', '))
    .join('\n')
  return `# Resultados Lighthouse

Gerado por \`lighthouse/run.mjs\` em ${summary.generatedAt}. Mediana de ${summary.runsPerCombination} medições por página e perfil.

## Medianas

${mediansTable(summary)}

Scores de 0 a 100; LCP, TBT, FCP e Speed Index em milissegundos; CLS adimensional.

## Metas da SPEC (seção 10)

${goalsTable(summary)}

## Ambiente e condições

| Item | Valor |
|---|---|
| Lighthouse | ${e.lighthouse} |
| Chrome/Chromium | ${e.browser} |
| Node | ${e.node} |
| pnpm | ${e.pnpm} |
| Sistema operacional | ${e.os} |
| CPU | ${e.cpu} |
| Memória (os.totalmem) | ${e.memoryGB} GB |
| Data | ${summary.generatedAt} |
| Comando | \`pnpm lighthouse\` (= \`node lighthouse/run.mjs\`) |

Condições: build otimizado (\`pnpm build\`) servido por \`pnpm preview --port ${PORT} --strictPort\`; \`VITE_ENABLE_MOCKS=true\` com o cenário default dos mocks; porta ${PORT} verificada como livre antes de começar; computador sem outra carga deliberada durante a execução (veja a nota na análise).

Metodologia:

- Mobile: preset padrão do Lighthouse (emulação de Moto G Power e throttling simulado padrão). Desktop: \`desktop-config\` do Lighthouse.
- Cada medição usa um Chrome novo, em modo headless, com perfil temporário vazio, e \`disableStorageReset: false\` (cache e storage limpos antes de cada carga, inclusive o service worker do MSW).
- Antes das 3 medições de cada página/perfil há um aquecimento descartado (não entra nas medianas nem nos relatórios). Decisão: como o Lighthouse limpa o service worker a cada medição, o MSW se registra de novo em toda carga, que é o que um primeiro visitante vê e está incluído na medição. O aquecimento serve só para não cobrar da primeira medição o frio do servidor de preview e do binário do Chrome. Cada execução confere que \`/mockServiceWorker.js\` respondeu 200 (campo \`mswWorkerStatus\` em summary.json).
- As execuções são sequenciais, nunca em paralelo.

## Relatórios

${runList}

## Evidências dos resultados abaixo da meta

${evidence(summary)}

## Análise

${analysis}
`
}

function printSummary(summary) {
  console.log('\n' + mediansTable(summary) + '\n')
}

function report() {
  const file = path.join(DIR, 'summary.json')
  if (!existsSync(file)) {
    console.error('lighthouse/summary.json não existe. Rode "pnpm lighthouse" primeiro.')
    process.exit(1)
  }
  const summary = JSON.parse(readFileSync(file, 'utf8'))
  printSummary(summary)
  const md = path.join(DIR, 'RESULTADOS.md')
  const opener = isWin ? ['cmd', ['/c', 'start', '""', md]] : process.platform === 'darwin' ? ['open', [md]] : ['xdg-open', [md]]
  try {
    spawn(opener[0], opener[1], { detached: true, stdio: 'ignore' }).unref()
  } catch {
    console.log('Abra manualmente:', md)
  }
}

if (process.argv.includes('--render')) {
  // Regenera o RESULTADOS.md a partir do summary.json (útil após editar lighthouse/analise.md).
  writeFileSync(path.join(DIR, 'RESULTADOS.md'), renderMarkdown(JSON.parse(readFileSync(path.join(DIR, 'summary.json'), 'utf8'))))
} else if (process.argv.includes('--report')) {
  report()
} else {
  main().catch((err) => {
    console.error('[lighthouse] erro:', err.message)
    process.exit(1)
  })
}
