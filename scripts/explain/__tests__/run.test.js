import { describe, it, expect } from 'vitest'
import { runExplain } from '../run.js'

const sleep = async () => {}
const mk = (name) => ({
  id: name,
  key: `key-${name}`,
  definition: { kind: 'class', name, isElement: false, fields: [{ name: 'f' }] },
  context: {},
})
const a = mk('A')
const b = mk('B')
const c = mk('C')
const okAnswer = { fields: { f: 'forklaring' } }
const entryA = { id: 'A', output: { fields: { f: 'gammel' } }, createdAt: '2020-01-01T00:00:00.000Z' }

function fakeClient(impl) {
  const client = {
    calls: 0,
    active: 0,
    maxActive: 0,
    async generate(prompt) {
      client.calls++
      client.active++
      client.maxActive = Math.max(client.maxActive, client.active)
      try {
        await Promise.resolve()
        return impl ? await impl(prompt, client.calls) : okAnswer
      } finally {
        client.active--
      }
    },
  }
  return client
}
const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), { status })

describe('runExplain', () => {
  it('hopper over forespørsler som finnes i hurtigbufferen', async () => {
    const client = fakeClient()
    await runExplain({ requests: [a, b], cache: { [a.key]: entryA }, client, sleep })
    expect(client.calls).toBe(1)
  })

  it('respekterer maxRequests og teller resten som skipped', async () => {
    const r = await runExplain({ requests: [a, b, c], cache: {}, client: fakeClient(), maxRequests: 2, sleep })
    expect(r).toEqual({ made: 2, failed: 0, skipped: 1 })
  })

  it('sender forespørsler med samme nøkkel bare én gang', async () => {
    const client = fakeClient()
    const r = await runExplain({ requests: [a, { ...a }], cache: {}, client, sleep })
    expect(client.calls).toBe(1)
    expect(r).toEqual({ made: 1, failed: 0, skipped: 0 })
  })

  it('prøver igjen ved 429 og 503 med eksponentiell pause', async () => {
    const pauses = []
    const client = fakeClient((_, n) => {
      if (n === 1) throw httpError(429)
      if (n === 2) throw httpError(503)
      return okAnswer
    })
    const r = await runExplain({ requests: [a], cache: {}, client, sleep: async (ms) => pauses.push(ms) })
    expect(r).toEqual({ made: 1, failed: 0, skipped: 0 })
    expect(pauses).toEqual([1000, 2000])
  })

  it('gir opp etter 3 nye forsøk og fortsetter med resten', async () => {
    const pauses = []
    const client = fakeClient((prompt) => {
      if (prompt.user.includes('"name": "A"')) throw httpError(500)
      return okAnswer
    })
    const cache = {}
    const r = await runExplain({ requests: [a, b], cache, client, sleep: async (ms) => pauses.push(ms), concurrency: 1 })
    expect(r).toEqual({ made: 1, failed: 1, skipped: 0 })
    expect(client.calls).toBe(5)
    expect(pauses).toEqual([1000, 2000, 4000])
    expect(cache[a.key]).toBeUndefined()
    expect(cache[b.key]).toBeDefined()
  })

  it('prøver ikke igjen ved 400', async () => {
    const client = fakeClient(() => { throw httpError(400) })
    const r = await runExplain({ requests: [a], cache: {}, client, sleep })
    expect(client.calls).toBe(1)
    expect(r).toEqual({ made: 0, failed: 1, skipped: 0 })
  })

  it('prøver igjen ved feil uten status', async () => {
    const client = fakeClient((_, n) => {
      if (n === 1) throw new Error('nettverk')
      return okAnswer
    })
    const r = await runExplain({ requests: [a], cache: {}, client, sleep })
    expect(r.made).toBe(1)
  })

  it('lagrer ikke ugyldige svar', async () => {
    const cache = {}
    const r = await runExplain({ requests: [a], cache, client: fakeClient(() => ({ nonsense: true })), sleep })
    expect(r).toEqual({ made: 0, failed: 1, skipped: 0 })
    expect(cache).toEqual({})
  })

  it('lagrer oppføring med id, output og createdAt', async () => {
    const cache = {}
    await runExplain({ requests: [a], cache, client: fakeClient(), sleep, now: () => 'T' })
    expect(cache[a.key]).toEqual({ id: 'A', output: okAnswer, createdAt: 'T' })
  })

  it('kaller onEntry etter hver ny oppføring', async () => {
    let n = 0
    await runExplain({ requests: [a, b], cache: {}, client: fakeClient(), sleep, onEntry: () => n++ })
    expect(n).toBe(2)
  })

  it('kjører maks concurrency kall samtidig', async () => {
    const client = fakeClient(async () => {
      await new Promise((r) => setTimeout(r, 5))
      return okAnswer
    })
    await runExplain({ requests: [a, b, c, mk('D')], cache: {}, client, concurrency: 2, sleep })
    expect(client.maxActive).toBe(2)
  })
})
