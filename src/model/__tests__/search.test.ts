import { describe, it, expect } from 'vitest'
import { search } from '../search'
import { fixture } from './fixture'

describe('search', () => {
  it('finner enum via verdi, case-insensitivt', () => {
    expect(search(fixture, 'railstation').enums.map((e) => e.name)).toEqual(['StopTypeEnumeration'])
    expect(search(fixture, 'stoptypeenum').enums.map((e) => e.name)).toEqual(['StopTypeEnumeration'])
  })
  it('finner enum på navn "StopType"', () => {
    expect(search(fixture, 'StopType').enums.map((e) => e.name)).toContain('StopTypeEnumeration')
  })
  it('finner felt quays på StopPlace', () => {
    const r = search(fixture, 'quays')
    expect(r.fields.some((f) => f.element.name === 'StopPlace' && f.field.name === 'quays')).toBe(true)
  })
  it('tom q gir tomme lister', () => {
    expect(search(fixture, '  ')).toEqual({ elements: [], fields: [], enums: [] })
  })
  it('begrenser til 50 per gruppe', () => {
    const many = { ...fixture, elements: Array.from({ length: 80 }, (_, i) => ({ ...fixture.elements[2], name: `Foo${i}` })) }
    expect(search(many, 'foo').elements).toHaveLength(50)
  })
})
