import { promptFor, validate } from './prompt.js'

const erGjentakbar = (err) => err?.status === undefined || err.status === 429 || err.status >= 500

/**
 * Kjører forespørslene mot klienten og fyller hurtigbufferen.
 * Muterer `cache`; `onEntry` kalles etter hver ny oppføring.
 * `onFail(request, reason)` kalles for hver mislykket forespørsel; reason er Error eller 'ugyldig svar'.
 * Etter `maxConsecutiveErrors` påfølgende kastede feil (etter nye forsøk) startes ingen nye forespørsler.
 * Returnerer { made, failed, skipped, errors, invalid, aborted? }; failed = errors + invalid.
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
  onFail = () => {},
  maxConsecutiveErrors = 20,
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
  const result = { made: 0, failed: 0, skipped: todo.length - queue.length, errors: 0, invalid: 0 }
  let consecutiveErrors = 0

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

  async function explainOne(request) {
    let output = null
    let reason = 'ugyldig svar'
    try {
      output = validate(request, await generate(request))
      consecutiveErrors = 0
    } catch (err) {
      reason = err
      consecutiveErrors++
    }
    if (!output) {
      if (reason === 'ugyldig svar') result.invalid++
      else result.errors++
      result.failed++
      onFail(request, reason)
      return
    }
    cache[request.key] = { id: request.id, output, createdAt: now() }
    result.made++
    onEntry()
  }

  let next = 0
  const worker = async () => {
    while (next < queue.length) {
      if (consecutiveErrors >= maxConsecutiveErrors) {
        result.aborted = true
        return
      }
      await explainOne(queue[next++])
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, queue.length)) }, worker))
  // Forespørsler som ikke ble startet etter avbrudd regnes som utsatt
  result.skipped += queue.length - next
  return result
}
