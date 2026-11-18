import { describe, it, expect } from 'vitest'
import { buildRequests, withKeys, cacheKey, stableStringify } from '../requests.js'

const fld = (name, origin, extra = {}) => ({
  name, type: 'xsd:string', kind: 'string', isAttribute: false, isList: false,
  minOccurs: '0', maxOccurs: '1', required: false, origin, description: `${name} of ${origin}.`, ...extra,
})

const makeVersion = (version, { lineDesc = 'En linje.', extraElements = [] } = {}) => ({
  version,
  fetchedAt: '2026-01-01',
  elements: [
    {
      name: 'Line', abstract: false, part: 1, module: 'line', description: lineDesc,
      ancestors: [{ name: 'Entity', abstract: true }],
      fields: [
        fld('id', 'Entity', { type: 'LineIdType', description: 'Id.' }),
        fld('TransportMode', 'Line', { type: 'ModeEnum', kind: 'enum', description: 'Mode of LINE.' }),
        fld('Extra', 'KeyListStructure'),
      ],
    },
    {
      name: 'LineView', abstract: false, part: 1, module: 'line', description: 'Visning.',
      ancestors: [{ name: 'Entity', abstract: true }, { name: 'Line', abstract: false }],
      fields: [
        fld('id', 'Entity', { type: 'ViewIdType', description: 'Id.' }),
        fld('TransportMode', 'Line', { type: 'ModeEnum', kind: 'enum', description: 'Mode of LINE view.' }),
        fld('Extra', 'KeyListStructure'),
      ],
    },
    ...extraElements,
  ],
  enums: {
    ModeEnum: { name: 'ModeEnum', description: 'Transportmodus.', values: [{ value: 'bus', description: 'Buss' }] },
  },
  structures: {
    KeyListStructure: [fld('Key', 'KeyListStructure')],
  },
  substitutions: {},
  examples: [],
})

const v20 = makeVersion('2.0')
const v20copy = makeVersion('2.0b')
const v13 = makeVersion('1.3', { lineDesc: 'Gammel linje.' })

const typeReq = (res, name) => res.requests.find((r) => r.id === `type:${name}`)

describe('buildRequests', () => {
  it('lager én typeforespørsel per definerende type, også fra structures', () => {
    const { requests } = buildRequests([v20])
    expect(requests.filter((r) => r.definition.kind === 'type').map((r) => r.definition.name).sort())
      .toEqual(['Entity', 'KeyListStructure', 'Line', 'LineView'])
  })

  it('feltet på origin selv er kanonisk variant', () => {
    const line = typeReq(buildRequests([v20]), 'Line')
    expect(line.definition.fields.find((f) => f.name === 'TransportMode').description).toBe('Mode of LINE.')
  })

  it('uten feltet på origin brukes vanligste variant, likt antall → alfabetisk første element', () => {
    const entity = typeReq(buildRequests([v20]), 'Entity')
    expect(entity.definition.fields.find((f) => f.name === 'id').type).toBe('LineIdType')
  })

  it('vanligste variant vinner over alfabetisk rekkefølge', () => {
    const extra = ['Mview', 'Nview'].map((name) => ({
      name, abstract: false, part: 1, module: 'line', description: '', ancestors: [],
      fields: [fld('id', 'Entity', { type: 'ViewIdType', description: 'Id.' })],
    }))
    const entity = typeReq(buildRequests([makeVersion('x', { extraElements: extra })]), 'Entity')
    expect(entity.definition.fields.find((f) => f.name === 'id').type).toBe('ViewIdType')
  })

  it('elementer får isElement, part og module; andre typer ikke', () => {
    const res = buildRequests([v20])
    expect(typeReq(res, 'Line').definition).toMatchObject({ isElement: true, part: 1, module: 'line', ancestors: ['Entity'] })
    expect(typeReq(res, 'Entity').definition.isElement).toBe(false)
    expect(typeReq(res, 'Entity').definition).not.toHaveProperty('part')
  })

  it('enumforespørsel med usedBy fra Element.felt', () => {
    const e = buildRequests([v20]).requests.find((r) => r.id === 'enum:ModeEnum')
    expect(e.definition).toEqual({
      kind: 'enum', name: 'ModeEnum', description: 'Transportmodus.', values: [{ value: 'bus', description: 'Buss' }],
    })
    expect(e.context.usedBy).toEqual(['Line.TransportMode', 'LineView.TransportMode'])
  })

  it('like definisjoner i to versjoner gir én forespørsel', () => {
    expect(withKeys(buildRequests([v20, v20copy]), 'm', 'p').requests)
      .toHaveLength(withKeys(buildRequests([v20]), 'm', 'p').requests.length)
  })

  it('ulik definisjon i to versjoner gir to nøkler med samme id', () => {
    const r = withKeys(buildRequests([v13, v20]), 'm', 'p')
    expect(r.requests.filter((x) => x.id === 'type:Line').map((x) => x.key)).toHaveLength(2)
    expect(new Set(r.requests.filter((x) => x.id === 'type:Line').map((x) => x.key)).size).toBe(2)
  })

  it('byVersion peker på nøklene som gjelder for hver versjon', () => {
    const r = withKeys(buildRequests([v13, v20]), 'm', 'p')
    const lineKeyOf = (v) => r.requests.find((x) => x.id === 'type:Line' && r.byVersion[v].types.includes(x.key)).definition.description
    expect(lineKeyOf('1.3')).toBe('Gammel linje.')
    expect(lineKeyOf('2.0')).toBe('En linje.')
    expect(r.byVersion['2.0'].enums).toHaveLength(1)
    for (const v of ['1.3', '2.0']) {
      for (const k of [...r.byVersion[v].types, ...r.byVersion[v].enums]) {
        expect(r.requests.some((x) => x.key === k)).toBe(true)
      }
    }
  })

  it('usedBy påvirker ikke nøkkelen', () => {
    const user = {
      name: 'Route', abstract: false, part: 1, module: 'route', description: '', ancestors: [],
      fields: [fld('LineRef', 'Route', { kind: 'ref', refTarget: 'Line' })],
    }
    const a = typeReq(withKeys(buildRequests([v20]), 'm', 'p'), 'Line')
    const b = typeReq(withKeys(buildRequests([makeVersion('2.0', { extraElements: [user] })]), 'm', 'p'), 'Line')
    expect(b.context.usedBy).toContain('Route.LineRef')
    expect(a.context.usedBy).not.toContain('Route.LineRef')
    expect(b.key).toBe(a.key)
  })

  it('usedBy er maks 10 (sortert) og members maks 20', () => {
    const users = Array.from({ length: 12 }, (_, i) => ({
      name: `User${String(i).padStart(2, '0')}`, abstract: false, part: 1, module: 'x', description: '', ancestors: [],
      fields: [fld('LineRef', `User${String(i).padStart(2, '0')}`, { kind: 'ref', refTarget: 'Line' })],
    }))
    const v = makeVersion('2.0', { extraElements: users })
    v.substitutions = { Entity: Array.from({ length: 25 }, (_, i) => `M${String(i).padStart(2, '0')}`) }
    const res = buildRequests([v])
    const line = typeReq(res, 'Line')
    expect(line.context.usedBy).toHaveLength(10)
    expect(line.context.usedBy).toEqual([...line.context.usedBy].sort())
    expect(typeReq(res, 'Entity').definition.members).toHaveLength(20)
  })
})

describe('cacheKey', () => {
  const def = { kind: 'enum', name: 'X', description: '', values: [] }
  it('er deterministisk og uavhengig av nøkkelrekkefølge', () => {
    expect(cacheKey(def, 'm', 'p')).toBe(cacheKey({ values: [], description: '', name: 'X', kind: 'enum' }, 'm', 'p'))
    expect(cacheKey(def, 'm', 'p')).toMatch(/^[0-9a-f]{64}$/)
  })
  it('endres med modell og promptversjon', () => {
    const keys = new Set([cacheKey(def, 'm', 'p'), cacheKey(def, 'm2', 'p'), cacheKey(def, 'm', 'p2')])
    expect(keys.size).toBe(3)
  })
})

describe('stableStringify', () => {
  it('sorterer objektnøkler rekursivt og bevarer arrayrekkefølge', () => {
    expect(stableStringify({ b: 1, a: { d: [2, 1], c: 0 } })).toBe('{"a":{"c":0,"d":[2,1]},"b":1}')
  })
})
