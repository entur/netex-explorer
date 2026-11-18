import type { Plugin } from 'vite'

export interface UniformenLayout {
  headAssets: string
  headerHtml: string
  footerHtml: string
  scripts: string
}

const DEFAULT_URL = 'https://uniformen.entur.no/ssr?simple=true&locale=nb-NO'

export function injectUniformen(html: string, layout: UniformenLayout | null): string {
  if (!layout) return html
  let out = html
  out = out.replace('</head>', () => `${layout.headAssets}</head>`)
  out = out.replace('<div id="root">', () => `${layout.headerHtml}<div id="root">`)
  out = out.replace(/(<div id="root">[\s\S]*?<\/div>)/, (m) => `${m}${layout.footerHtml}`)
  out = out.replace('</body>', () => `${layout.scripts}</body>`)
  return out
}

export function uniformen(
  opts: { url?: string; timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Plugin {
  const url = opts.url ?? DEFAULT_URL
  const timeoutMs = opts.timeoutMs ?? 2000
  const fetchImpl = opts.fetchImpl ?? fetch
  let cached: Promise<UniformenLayout | null> | undefined

  const load = async (): Promise<UniformenLayout | null> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetchImpl(url, { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = (await res.json()) as Partial<UniformenLayout>
      return {
        headAssets: j.headAssets ?? '',
        headerHtml: j.headerHtml ?? '',
        footerHtml: j.footerHtml ?? '',
        scripts: j.scripts ?? '',
      }
    } catch (e) {
      console.warn(`[uniformen] kunne ikke hente skall, bygger uten: ${(e as Error).message}`)
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    name: 'uniformen',
    transformIndexHtml: {
      order: 'pre',
      async handler(html: string) {
        cached ??= load()
        return injectUniformen(html, await cached)
      },
    },
  }
}
