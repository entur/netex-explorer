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
})
