/** Sorterer nøklene i et objekt ved å sette dem inn i sortert rekkefølge. */
function sortedObject(entries) {
  const out = {}
  for (const [k, v] of [...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) out[k] = v
  return out
}

/**
 * Bygger forklaringsfilen for én versjon fra hurtigbufferen.
 * Nøkler uten forespørsel eller uten hurtigbufferoppføring hoppes over.
 */
export function buildVersionFile({ version, keys, requests, cache, model, generatedAt }) {
  const byKey = new Map(requests.map((r) => [r.key, r]))
  const types = []
  const fields = []
  const enums = []

  for (const key of keys.types) {
    const name = byKey.get(key)?.definition.name
    const output = cache[key]?.output
    if (name === undefined || !output) continue
    if (output.type !== undefined) types.push([name, output.type])
    for (const [field, text] of Object.entries(output.fields ?? {})) fields.push([`${name}.${field}`, text])
  }
  for (const key of keys.enums) {
    const name = byKey.get(key)?.definition.name
    const text = cache[key]?.output?.enum
    if (name === undefined || text === undefined) continue
    enums.push([name, text])
  }

  return {
    version,
    model,
    generatedAt,
    types: sortedObject(types),
    fields: sortedObject(fields),
    enums: sortedObject(enums),
  }
}

/** Fjerner hurtigbufferoppføringer som ikke er i bruk. Muterer `cache`, returnerer antall fjernet. */
export function pruneCache(cache, liveKeys) {
  let removed = 0
  for (const key of Object.keys(cache)) {
    if (!liveKeys.has(key)) {
      delete cache[key]
      removed++
    }
  }
  return removed
}

/** Alle tekster i en fil som én map, med prefiks per kategori for å unngå kollisjoner. */
function flatten(file) {
  const out = new Map()
  if (!file) return out
  for (const category of ['types', 'fields', 'enums']) {
    for (const [name, text] of Object.entries(file[category] ?? {})) out.set(`${category}:${name}`, { name, text })
  }
  return out
}

const MAX_SAMPLE_LENGTH = 200

/** Gjør teksten trygg i en PR-beskrivelse: én linje, avkortet, og i kode slik at @navn og #nr ikke utløser varsler. */
function sanitize(text) {
  let t = String(text).replace(/\s+/g, ' ').trim().replace(/`/g, "'")
  if (t.length > MAX_SAMPLE_LENGTH) t = `${t.slice(0, MAX_SAMPLE_LENGTH - 1)}…`
  return `\`${t}\``
}

/** Markdown til PR-beskrivelsen: modell, endringer per versjon og et utvalg nye tekster. */
export function summarize(before, after, { model, sampleSize = 10 }) {
  const lines = [
    'Teksten under er KI-generert og må ses over før PR-en merges.',
    '',
    `Modell: ${model}`,
    '',
    '## Endringer per versjon',
    '',
  ]
  const samples = new Map()

  const versions = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
  for (const version of versions) {
    const prev = flatten(before[version])
    const next = flatten(after[version]) // manglende etter-fil: alt regnes som fjernet
    let added = 0
    let changed = 0
    let removed = 0
    for (const [id, { name, text }] of next) {
      const old = prev.get(id)
      if (!old) {
        added++
        const sampleKey = `${name}\n${text}`
        if (!samples.has(sampleKey)) samples.set(sampleKey, `- **${name}**: ${sanitize(text)}`)
      } else if (old.text !== text) changed++
    }
    for (const id of prev.keys()) if (!next.has(id)) removed++
    lines.push(`- ${version}: ${added} ${added === 1 ? 'ny' : 'nye'}, ${changed} endret, ${removed} fjernet`)
  }

  const shown = [...samples.values()].slice(0, sampleSize)
  if (shown.length > 0) lines.push('', '## Utvalg av nye tekster', '', ...shown)
  return lines.join('\n') + '\n'
}

/** Beholder forrige `generatedAt` når alt annet er likt, slik at filen blir byte-identisk og ingen PR trengs. */
export function keepTimestampIfUnchanged(before, after) {
  if (!before) return after
  const strip = (f) => JSON.stringify({ ...f, generatedAt: undefined })
  return strip(before) === strip(after) ? { ...after, generatedAt: before.generatedAt } : after
}
