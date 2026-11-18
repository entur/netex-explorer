import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const data = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/netex-v2.0.json'), 'utf8'))
const stopPlace = data.elements.find((e) => e.name === 'StopPlace')
const field = (name) => stopPlace.fields.find((f) => f.name === name)

describe('generated NeTEx v2.0 data', () => {
  it('StopPlace ancestors follow the XSD', () => {
    expect(stopPlace.ancestors.map((a) => a.name)).toEqual([
      'Entity', 'EntityInVersion', 'DataManagedObject', 'GroupOfEntities', 'GroupOfPoints',
      'Zone', 'Place', 'AddressablePlace', 'SiteElement', 'Site',
    ])
  })
  it('id is a required attribute', () => {
    expect(field('id')).toMatchObject({ isAttribute: true, required: true })
  })
  it('version is an attribute', () => {
    expect(field('version').isAttribute).toBe(true)
  })
  it('Name originates in GroupOfEntities', () => {
    expect(field('Name').origin).toBe('GroupOfEntities')
  })
  it('quays contains Quay', () => {
    expect(field('quays').contains.map((c) => c.name)).toContain('Quay')
  })
  it('StopTypeEnumeration has railStation', () => {
    expect(data.enums.StopTypeEnumeration.values.map((v) => v.value)).toContain('railStation')
  })
  it('OtherTransportModes is an enum list', () => {
    expect(field('OtherTransportModes')).toMatchObject({ kind: 'enum', isList: true })
  })
  it('Operator is a framework element (part 0)', () => {
    expect(data.elements.some((e) => e.name === 'Operator' && e.part === 0)).toBe(true)
  })
  it('PublicCode is complex with structure PublicCodeStructure', () => {
    expect(field('PublicCode')).toMatchObject({ kind: 'complex', structure: 'PublicCodeStructure' })
    expect(data.structures.PublicCodeStructure).toBeDefined()
  })
  it('ValidBetween resolves through its inline type and links the element', () => {
    const f = field('ValidBetween')
    expect(['string', 'unknown']).not.toContain(f.kind)
    expect(f.refTarget ?? f.structure).toBeTruthy()
  })
})

const owners = [
  ...data.elements.map((e) => [e.name, e.fields]),
  ...Object.entries(data.structures),
]
const allFields = owners.flatMap(([, fields]) => fields)
const elementNames = new Set(data.elements.map((e) => e.name))

/** Defined only under xsd/netex_part_5 (not parsed: Part 5 is out of scope), but referenced from Parts 1–3. */
const PART_5_ONLY = new Set([
  'GroupOfSingleJourneysRef', 'IndividualTravellerRef', 'MobilityServiceConstraintZoneRef', 'MobilityServiceRef',
  'ServiceAccessCode', 'SingleJourneyPathRef', 'SingleJourneyRef', 'VehicleMeetingLinkRef', 'VehicleMeetingPlaceRef',
  'VehicleMeetingPointRef', 'VehiclePoolingDriverInfoRef',
])
const notParsed = (name) => /^(gml|siri):/.test(name) || PART_5_ONLY.has(name)

/** Named *ListOfEnumerations whose itemType is not an enum in the XSD (xsd:language, CurrencyType = xsd:NMTOKEN). */
const LISTS_OF_TEXT = new Set(['LanguageListOfEnumerations', 'CurrencyListOfEnumerations'])

describe('generated NeTEx v2.0 data invariants', () => {
  it('no element field has an empty type', () => {
    const empty = owners.flatMap(([owner, fields]) => fields.filter((f) => !f.isAttribute && !f.type).map((f) => `${owner}.${f.name}`))
    expect(empty).toEqual([])
  })

  it('every used *Enumeration / *ListOfEnumerations type resolves to an enum', () => {
    const notEnum = allFields
      .filter((f) => /(Enumeration|ListOfEnumerations)$/.test(f.type) && f.kind !== 'enum' && !LISTS_OF_TEXT.has(f.type))
      .map((f) => `${f.name}: ${f.type} (${f.kind})`)
    expect([...new Set(notEnum)]).toEqual([])
    for (const f of allFields.filter((x) => x.kind === 'enum')) expect(data.enums[f.type], f.type).toBeDefined()
  })

  it('no element or structure has duplicate (origin, name, isAttribute) fields', () => {
    const dupes = owners.flatMap(([owner, fields]) => {
      const seen = new Set()
      return fields.flatMap((f) => {
        const key = `${f.origin}|${f.name}|${f.isAttribute}`
        if (seen.has(key)) return [`${owner}: ${key}`]
        seen.add(key)
        return []
      })
    })
    expect(dupes).toEqual([])
  })

  it('unknown types only come from schemas that are not parsed (gml:, siri:, Part 5)', () => {
    const unknown = allFields.filter((f) => f.kind === 'unknown' && !f.isAttribute)
    expect([...new Set(unknown.map((f) => f.type).filter((t) => !notParsed(t)))]).toEqual([])
  })

  it('every substitutions member is a concrete output element', () => {
    for (const [head, members] of Object.entries(data.substitutions)) {
      expect(elementNames.has(head), head).toBe(false)
      for (const m of members) expect(elementNames.has(m), `${head} → ${m}`).toBe(true)
    }
  })

  it('every ref entry in contains is an output element or a substitution head', () => {
    const unresolved = new Set()
    for (const f of allFields) {
      for (const c of f.contains ?? []) {
        if (c.ref && !elementNames.has(c.name) && !data.substitutions[c.name]) unresolved.add(c.name)
      }
    }
    expect([...unresolved].filter((n) => !notParsed(n))).toEqual([])
  })
})
