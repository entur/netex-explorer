// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { injectUniformen, uniformen } from '../uniformen-plugin'

const layout = {
  headAssets: '<link data-a>',
  headerHtml: '<header data-h></header>',
  footerHtml: '<footer data-f></footer>',
  scripts: '<script data-s></script>',
}
const html = '<html><head></head><body><div id="root"></div></body></html>'

describe('injectUniformen', () => {
  it('injects four parts in place', () => {
    const out = injectUniformen(html, layout)
    expect(out).toContain('<link data-a></head>')
    expect(out).toContain('<header data-h></header><div id="root"></div>')
    expect(out).toContain('</div><footer data-f></footer>')
    expect(out).toContain('<script data-s></script></body>')
  })
  it('returns html unchanged when layout is null', () => {
    expect(injectUniformen(html, null)).toBe(html)
  })
})

describe('uniformen plugin', () => {
  it('plugin resolves to null on timeout', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchImpl = ((_u: unknown, init?: { signal?: AbortSignal }) =>
      new Promise((_res, rej) => {
        init?.signal?.addEventListener('abort', () => rej(new Error('aborted')))
      })) as unknown as typeof fetch
    const plugin = uniformen({ timeoutMs: 10, fetchImpl })
    const hook = plugin.transformIndexHtml as { handler: (h: string) => Promise<string> }
    const out = await hook.handler(html)
    expect(out).toBe(html)
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
  it('caches the layout per plugin instance', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => layout })) as unknown as typeof fetch
    const plugin = uniformen({ fetchImpl })
    const hook = plugin.transformIndexHtml as { handler: (h: string) => Promise<string> }
    await hook.handler(html)
    await hook.handler(html)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
