import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { buildRequests, withKeys } from './explain/requests.js'
import { PROMPT_VERSION } from './explain/prompt.js'
import { runExplain } from './explain/run.js'
import { buildVersionFile, keepTimestampIfUnchanged, pruneCache, summarize } from './explain/output.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '../public/data')
const CACHE_PATH = join(__dirname, '../data/explanations-cache.json')
const SUMMARY_PATH = join(__dirname, '../explain-summary.md')

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.7-flash'
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'eu'
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT
const SAVE_EVERY = 25

function fail(message) {
  console.error(message)
  process.exit(1)
}

function parseMaxRequests(raw) {
  if (raw === undefined || raw === '') return 2000
  if (!/^\d+$/.test(raw)) fail(`Ugyldig MAX_REQUESTS: "${raw}" (forventet et heltall på 0 eller mer)`)
  return Number(raw)
}

const sortKeys = (obj) => Object.fromEntries(Object.entries(obj).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
const toJson = (value) => JSON.stringify(value, null, 2) + '\n'

function writeCache(cache) {
  const tmp = `${CACHE_PATH}.tmp`
  writeFileSync(tmp, toJson(sortKeys(cache)))
  renameSync(tmp, CACHE_PATH)
}

const readJson = (path, fallback) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback)

const maxRequests = parseMaxRequests(process.env.MAX_REQUESTS)

// 1. Last versjonene
const manifest = readJson(join(DATA_DIR, 'versions.json'), { versions: [] })
// Appens standardversjon (DEFAULT_VERSION i src/model/urlState.ts) først, så taket fyller det brukerne ser først
const DEFAULT_VERSION = 'v2.0'
const versions = manifest.versions
  .filter((v) => !v.error && v.file)
  .map((v) => JSON.parse(readFileSync(join(DATA_DIR, v.file), 'utf8')))
  .sort((a, b) => (b.version === DEFAULT_VERSION) - (a.version === DEFAULT_VERSION))

// 2. Forespørsler og hurtigbuffer
const { requests, byVersion } = withKeys(buildRequests(versions), MODEL, PROMPT_VERSION)
const cache = readJson(CACHE_PATH, {})
const missing = requests.some((r) => !cache[r.key])

// 3. Kall modellen om det trengs
let result = { made: 0, failed: 0, skipped: 0, errors: 0, invalid: 0 }
if (maxRequests > 0 && missing) {
  if (!PROJECT) fail('GOOGLE_CLOUD_PROJECT må settes for å generere forklaringer')
  const { createGeminiClient } = await import('./explain/gemini.js')
  const client = await createGeminiClient({ project: PROJECT, location: LOCATION, model: MODEL })
  let sinceSave = 0
  try {
    result = await runExplain({
      requests,
      cache,
      client,
      maxRequests,
      onFail: (request, reason) => {
        console.error(`Feilet: ${request.id} — ${reason instanceof Error ? reason.message : reason}`)
      },
      onEntry: () => {
        if (++sinceSave >= SAVE_EVERY) {
          sinceSave = 0
          writeCache(cache)
        }
      },
    })
  } finally {
    // Lagre det som er laget selv om kjøringen kastet
    writeCache(cache)
  }
}

// 4. Rydd og skriv hurtigbufferen
const removed = pruneCache(cache, new Set(requests.map((r) => r.key)))
writeCache(cache)

// 5. Skriv versjonsfiler og sammendrag
const generatedAt = new Date().toISOString()
const before = {}
const after = {}
for (const { version } of versions) {
  const path = join(DATA_DIR, `explanations-${version}.json`)
  before[version] = readJson(path, null)
  after[version] = keepTimestampIfUnchanged(before[version], buildVersionFile({
    version,
    keys: byVersion[version],
    requests,
    cache,
    model: MODEL,
    generatedAt,
  }))
  writeFileSync(path, toJson(after[version]))
}
writeFileSync(SUMMARY_PATH, summarize(before, after, { model: MODEL }))

// 6. Logg og avslutt
console.log(
  `laget ${result.made}, feilet ${result.errors} (feil) + ${result.invalid} (ugyldig svar), utsatt ${result.skipped}, fjernet fra hurtigbuffer ${removed}`,
)
if (result.aborted) console.error('Avbrutt: for mange påfølgende feil')
// Ugyldige svar alene feiler ikke jobben; avbrudd eller bare feil uten fremgang gjør det
if (result.aborted || (result.errors > 0 && result.made === 0)) process.exit(1)
