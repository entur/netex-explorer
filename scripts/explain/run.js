import { promptFor, validate } from './prompt.js'

const erGjentakbar = (err) => err?.status === undefined || err.status === 429 || err.status >= 500

/**
 * Kjører forespørslene mot klienten og fyller hurtigbufferen.
 * Muterer `cache`; `onEntry` kalles etter hver ny oppføring.
 * Returnerer antall lagde, mislykkede og (pga. tak) hoppede forespørsler.
 */
export async function runExplain({
  requests,
  cache,
  client,
  maxRequests = 2000,
  concurrency = 4,
  retries = 3,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  onEntry = () => {},
  now = () => new Date().toISOString(),
}) {
  // Utelat treff i hurtigbufferen og duplikate nøkler; behold rekkefølgen
  const seen = new Set()
  const todo = []
  for (const r of requests) {
    if (cache[r.key] || seen.has(r.key)) continue
    seen.add(r.key)
    todo.push(r)
  }
  const queue = todo.slice(0, maxRequests)
  const result = { made: 0, failed: 0, skipped: todo.length - queue.length }

  async function generate(request) {
    const prompt = promptFor(request)
    for (let attempt = 0; ; attempt++) {
      try {
        return await client.generate(prompt)
      } catch (err) {
        if (attempt >= retries || !erGjentakbar(err)) throw err
        await sleep(1000 * 2 ** attempt)
      }
    }
  }

  async function process(request) {
    let output = null
    try {
      output = validate(request, await generate(request))
    } catch {
      output = null
    }
    if (!output) {
      result.failed++
      return
    }
    cache[request.key] = { id: request.id, output, createdAt: now() }
    result.made++
    onEntry()
  }

  let next = 0
  const worker = async () => {
    while (next < queue.length) await process(queue[next++])
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, queue.length)) }, worker))
  return result
}
