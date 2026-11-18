import { createHash } from 'node:crypto'

const MAX_USED_BY = 10
const MAX_MEMBERS = 20

/** JSON med sorterte objektnøkler (rekursivt), slik at likt innhold gir lik streng. */
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v ?? null)).join(',')}]`
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** Hex SHA-256 av promptversjon, modell og definisjon. Konteksten (usedBy) er med vilje utelatt. */
export function cacheKey(definition, model, promptVersion) {
  return createHash('sha256')
    .update(`${promptVersion}\n${model}\n${stableStringify(definition)}`)
    .digest('hex')
}

const toFieldDef = (f) => ({
  name: f.name,
  isAttribute: f.isAttribute,
  type: f.type,
  kind: f.kind,
  minOccurs: f.minOccurs,
  maxOccurs: f.maxOccurs,
  required: f.required,
  description: f.description,
})

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

/** Alle felt i versjonen sammen med eieren (element- eller strukturnavn) de står på. */
function collectFields(version) {
  const out = []
  for (const el of version.elements) for (const f of el.fields) out.push({ owner: el.name, field: f })
  for (const [name, fields] of Object.entries(version.structures ?? {})) {
    for (const f of fields) out.push({ owner: name, field: f })
  }
  return out
}

/** Kanonisk feltdefinisjon: feltet på origin selv, ellers vanligste variant (likt → alfabetisk første eier). */
function canonicalField(candidates, origin) {
  const own = candidates.find((c) => c.owner === origin)
  if (own) return toFieldDef(own.field)
  const variants = new Map()
  for (const c of candidates) {
    const def = toFieldDef(c.field)
    const id = stableStringify(def)
    const v = variants.get(id) ?? { def, count: 0, firstOwner: c.owner }
    v.count++
    if (c.owner < v.firstOwner) v.firstOwner = c.owner
    variants.set(id, v)
  }
  return [...variants.values()].sort((a, b) => b.count - a.count || cmp(a.firstOwner, b.firstOwner))[0].def
}

const limitedSorted = (set, max) => [...set].sort(cmp).slice(0, max)

function buildVersion(version) {
  const all = collectFields(version)
  const elementByName = new Map(version.elements.map((e) => [e.name, e]))

  // origin → feltnavn → kandidater
  const byOrigin = new Map()
  for (const c of all) {
    const origin = c.field.origin
    if (!byOrigin.has(origin)) byOrigin.set(origin, new Map())
    const names = byOrigin.get(origin)
    if (!names.has(c.field.name)) names.set(c.field.name, [])
    names.get(c.field.name).push(c)
  }

  // Alle elementer er definerende (også de uten egne felter), i tillegg til alle origins
  const typeNames = new Set([...byOrigin.keys(), ...version.elements.map((e) => e.name)])

  // Brukere per type/enum: Element.felt
  const typeUsers = new Map()
  const enumUsers = new Map()
  const add = (map, key, value) => {
    if (!map.has(key)) map.set(key, new Set())
    map.get(key).add(value)
  }
  for (const el of version.elements) {
    for (const f of el.fields) {
      const user = `${el.name}.${f.name}`
      if (f.refTarget) add(typeUsers, f.refTarget, user)
      if (f.type) {
        add(typeUsers, f.type, user)
        add(enumUsers, f.type, user)
      }
    }
  }

  const types = [...typeNames].sort(cmp).map((name) => {
    const el = elementByName.get(name)
    const names = byOrigin.get(name) ?? new Map()
    const fields = [...names.keys()].sort(cmp).map((n) => canonicalField(names.get(n), name))
    const definition = { kind: 'type', name, isElement: !!el }
    if (el) {
      definition.part = el.part
      definition.module = el.module
    }
    definition.description = el?.description ?? ''
    definition.ancestors = el ? el.ancestors.map((a) => a.name) : []
    definition.fields = fields
    definition.members = (version.substitutions?.[name] ?? []).slice(0, MAX_MEMBERS)
    return { id: `type:${name}`, definition, context: { usedBy: limitedSorted(typeUsers.get(name) ?? [], MAX_USED_BY) } }
  })

  const enums = Object.keys(version.enums ?? {}).sort(cmp).map((name) => {
    const e = version.enums[name]
    const definition = {
      kind: 'enum',
      name,
      description: e.description,
      values: e.values.map((v) => ({ value: v.value, description: v.description })),
    }
    return { id: `enum:${name}`, definition, context: { usedBy: limitedSorted(enumUsers.get(name) ?? [], MAX_USED_BY) } }
  })

  return { types, enums }
}

/** Midlertidig identitet før nøklene er satt: id pluss innholdet i definisjonen. */
const identity = (r) => `${r.id}#${stableStringify(r.definition)}`

/**
 * Bygger forespørsler (én per unik definisjon) for alle versjoner.
 * `key` er udefinert til `withKeys` har kjørt; `byVersion` bruker midlertidig identitet inntil da.
 */
export function buildRequests(versions) {
  const unique = new Map()
  const byVersion = {}
  for (const version of versions) {
    const { types, enums } = buildVersion(version)
    const register = (list) => list.map((r) => {
      const ident = identity(r)
      const existing = unique.get(ident)
      if (existing) {
        const merged = new Set([...existing.context.usedBy, ...r.context.usedBy])
        existing.context.usedBy = limitedSorted(merged, MAX_USED_BY)
      } else {
        unique.set(ident, { key: undefined, id: r.id, definition: r.definition, context: r.context })
      }
      return ident
    })
    byVersion[version.version] = { types: register(types), enums: register(enums) }
  }
  return { requests: [...unique.values()], byVersion }
}

/** Setter `key` (hurtigbuffernøkkel) på hver forespørsel og i `byVersion`. */
export function withKeys(result, model, promptVersion) {
  const keyOf = new Map()
  const requests = result.requests.map((r) => {
    const key = cacheKey(r.definition, model, promptVersion)
    keyOf.set(identity(r), key)
    return { ...r, key }
  })
  const byVersion = {}
  for (const [v, { types, enums }] of Object.entries(result.byVersion)) {
    byVersion[v] = { types: types.map((i) => keyOf.get(i)), enums: enums.map((i) => keyOf.get(i)) }
  }
  return { requests, byVersion }
}
