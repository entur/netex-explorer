import { describe, it, expect } from 'vitest'
import { buildVersionFile, pruneCache, summarize } from '../output.js'

const req = (key, name, kind = 'type') => ({ key, id: `${kind}:${name}`, definition: { kind, name } })
const entry = (output) => ({ id: 'x', output, createdAt: '2026-01-01' })

const requests = [req('k1', 'Line'), req('k2', 'Entity'), req('k3', 'VehicleModeEnumeration', 'enum')]
const cache = {
  k1: entry({ type: 'L.', fields: { TransportMode: 'T.' } }),
  k2: entry({ type: 'E.', fields: { id: 'I.' } }),
  k3: entry({ enum: 'E.' }),
}
const args = {
  version: 'v2.0',
  keys: { types: ['k1', 'k2'], enums: ['k3'] },
  requests, cache, model: 'm', generatedAt: '2026-01-02',
}

const file = (over = {}) => ({ version: 'v2.0', model: 'm', generatedAt: 'g', types: {}, fields: {}, enums: {}, ...over })

describe('buildVersionFile', () => {
  it('bygger versjonsfil med type-, felt- og enum-tekster', () => {
    const f = buildVersionFile(args)
    expect(f).toMatchObject({
      version: 'v2.0', model: 'm', generatedAt: '2026-01-02',
      types: { Line: 'L.', Entity: 'E.' },
      fields: { 'Line.TransportMode': 'T.', 'Entity.id': 'I.' },
      enums: { VehicleModeEnumeration: 'E.' },
    })
  })
  it('sorterer nøklene', () => {
    const f = buildVersionFile(args)
    expect(Object.keys(f.types)).toEqual(['Entity', 'Line'])
    expect(Object.keys(f.fields)).toEqual(['Entity.id', 'Line.TransportMode'])
  })
  it('v1.3 og v2.0 får hver sin tekst når definisjonen er ulik', () => {
    const reqs = [req('a', 'Line'), req('b', 'Line')]
    const c = { a: entry({ type: 'gammel' }), b: entry({ type: 'ny' }) }
    const base = { requests: reqs, cache: c, model: 'm', generatedAt: 'g' }
    expect(buildVersionFile({ ...base, version: 'v1.3', keys: { types: ['a'], enums: [] } }).types.Line).toBe('gammel')
    expect(buildVersionFile({ ...base, version: 'v2.0', keys: { types: ['b'], enums: [] } }).types.Line).toBe('ny')
  })
  it('mangler i hurtigbufferen gir bare manglende oppføringer', () => {
    const f = buildVersionFile({ ...args, cache: { k1: cache.k1 } })
    expect(f.types).toEqual({ Line: 'L.' })
    expect(f.enums).toEqual({})
  })
})

describe('pruneCache', () => {
  it('pruneCache fjerner nøkler som ikke er i bruk', () => {
    const c = { a: entry({}), b: entry({}) }
    expect(pruneCache(c, new Set(['a']))).toBe(1)
    expect(Object.keys(c)).toEqual(['a'])
  })
})

describe('summarize', () => {
  const before = file({ types: { Line: 'a', Gone: 'g', Same: 's' }, fields: {}, enums: {} })
  const after = file({ types: { Line: 'b', Same: 's', Fresh: 'f' } })

  it('summarize teller nye, endrede og fjernede per versjon', () => {
    const s = summarize({ 'v2.0': before }, { 'v2.0': after }, { model: 'm' })
    expect(s).toMatch(/v2\.0.*1 ny.*1 endret.*1 fjernet/s)
    expect(s.split('\n')[0]).toMatch(/KI-generert/)
    expect(s).toContain('- **Fresh**: `f`')
    expect(s).not.toContain('- **Line**')
  })
  it('summarize håndterer at det ikke fantes noen fil før', () => {
    const s = summarize({ 'v2.0': null }, { 'v2.0': after }, { model: 'm' })
    expect(s).toMatch(/v2\.0.*3 nye.*0 endret.*0 fjernet/s)
  })
  it('begrenser utvalget og lister versjon uten endringer med nuller', () => {
    const many = file({ types: Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`T${i}`, `t${i}`])) })
    const s = summarize({ 'v2.0': null, 'v1.3': many }, { 'v2.0': many, 'v1.3': many }, { model: 'm', sampleSize: 2 })
    expect(s).toMatch(/v1\.3.*0 nye.*0 endret.*0 fjernet/s)
    expect(s.match(/^- \*\*/gm)).toHaveLength(2)
  })
  it('rapporterer versjon som finnes før men ikke etter, som fjernet', () => {
    const s = summarize({ 'v1.3': file({ types: { A: 'a', B: 'b' } }) }, {}, { model: 'm' })
    expect(s).toMatch(/v1\.3.*0 nye.*0 endret.*2 fjernet/s)
  })
  it('renser eksempeltekster til én inline-kode-span', () => {
    const s = summarize({}, { 'v2.0': file({ types: { Line: 'Hei @someone, se #12\nog `kode`' } }) }, { model: 'm' })
    expect(s).toContain("- **Line**: `Hei @someone, se #12 og 'kode'`")
    const long = summarize({}, { 'v2.0': file({ types: { L: 'x'.repeat(300) } }) }, { model: 'm' })
    expect(long).toContain(`\`${'x'.repeat(199)}…\``)
  })
})
