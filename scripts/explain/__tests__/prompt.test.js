import { describe, it, expect } from 'vitest'
import { PROMPT_VERSION, promptFor, validate } from '../prompt.js'

const typeReq = {
  id: 'type:Line',
  key: 'k1',
  definition: {
    kind: 'type',
    name: 'Line',
    isElement: true,
    description: 'En rute',
    ancestors: [],
    fields: [
      { name: 'Name', type: 'MultilingualString' },
      { name: 'TransportMode', type: 'AllVehicleModesOfTransportEnumeration' },
    ],
    members: [],
  },
  context: { usedBy: ['LineView.Line'] },
}
const typeReqView = { ...typeReq, context: { usedBy: ['LineView.TransportMode'] } }
const entityReq = {
  id: 'type:EntityStructure',
  key: 'k2',
  definition: { kind: 'type', name: 'EntityStructure', isElement: false, fields: [{ name: 'id' }], members: [] },
  context: { usedBy: [] },
}
const emptyReq = {
  id: 'type:Empty',
  key: 'k3',
  definition: { kind: 'type', name: 'Empty', isElement: true, fields: [], members: [] },
  context: { usedBy: [] },
}
const enumReq = {
  id: 'enum:ModeEnum',
  key: 'k4',
  definition: { kind: 'enum', name: 'ModeEnum', description: 'Modus', values: [{ value: 'bus', description: 'Buss' }] },
  context: { usedBy: ['Line.TransportMode'] },
}

describe('promptFor', () => {
  it('har promptversjon som streng', () => {
    expect(PROMPT_VERSION).toBe('1')
  })
  it('systemprompten krever norsk bokmål, uoversatte NeTEx-navn og ren tekst', () => {
    const { system } = promptFor(typeReq)
    expect(system).toMatch(/bokmål/)
    expect(system).toMatch(/markdown/i)
  })
  it('brukerprompten inneholder definisjon og usedBy', () => {
    const { user } = promptFor(typeReqView)
    expect(user).toContain('TransportMode')
    expect(user).toContain('LineView')
  })
  it('schema har en egenskap per felt', () => {
    const { schema } = promptFor(typeReq)
    expect(schema.type).toBe('OBJECT')
    expect(schema.properties.type).toEqual({ type: 'STRING', nullable: true })
    expect(Object.keys(schema.properties.fields.properties)).toEqual(['Name', 'TransportMode'])
    expect(schema.properties.fields.properties.Name).toEqual({ type: 'STRING' })
  })
  it('schema krever type og fields, og alle feltnavn', () => {
    const { schema } = promptFor(typeReq)
    expect(schema.required).toEqual(['type', 'fields'])
    expect(schema.properties.fields.required).toEqual(['Name', 'TransportMode'])
  })
  it('schema for type uten felt utelater fields', () => {
    const { schema } = promptFor(emptyReq)
    expect(schema.properties.fields).toBeUndefined()
    expect(schema.properties.type).toEqual({ type: 'STRING', nullable: true })
    expect(schema.required).toEqual(['type'])
  })
  it('schema for enum er en streng', () => {
    const { schema } = promptFor(enumReq)
    expect(schema.properties.enum).toEqual({ type: 'STRING' })
    expect(schema.properties.fields).toBeUndefined()
  })
})

describe('validate', () => {
  it('forkaster ukjente felter og tomme tekster', () => {
    expect(validate(typeReq, { type: ' Forklaring. ', fields: { Name: 'A', Ghost: 'B', TransportMode: '  ' } }))
      .toEqual({ type: 'Forklaring.', fields: { Name: 'A' } })
  })
  it('dropper type for typer som ikke er elementer', () => {
    expect(validate(entityReq, { type: 'X', fields: { id: 'Y' } })).toEqual({ fields: { id: 'Y' } })
  })
  it('utelater fields når ingen er gyldige', () => {
    expect(validate(typeReq, { type: 'T', fields: { Ghost: 'x' } })).toEqual({ type: 'T' })
  })
  it('gir null for søppel', () => {
    expect(validate(typeReq, 'tekst')).toBeNull()
    expect(validate(typeReq, null)).toBeNull()
    expect(validate(typeReq, { type: 5, fields: 'x' })).toBeNull()
    expect(validate(enumReq, { enum: '' })).toBeNull()
    expect(validate(enumReq, [])).toBeNull()
  })
  it('ignorerer fields som er en liste', () => {
    expect(validate(typeReq, { type: 'T', fields: ['Name'] })).toEqual({ type: 'T' })
  })
  it('validerer enum', () => {
    expect(validate(enumReq, { enum: ' Tekst ' })).toEqual({ enum: 'Tekst' })
  })
})
