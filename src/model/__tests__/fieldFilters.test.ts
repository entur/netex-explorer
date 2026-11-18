import { describe, expect, it } from 'vitest'
import { countFields, filterFields } from '../fieldFilters'
import { fixture } from './fixture'

const sp = fixture.elements.find((e) => e.name === 'StopPlace')!

describe('fieldFilters', () => {
  it('countFields', () => {
    expect(countFields(sp)).toEqual({ alle: 9, egne: 3, arvet: 6, pakrevd: 1, enums: 2 })
  })
  it('pakrevd gir bare required', () => {
    const r = filterFields(sp, 'pakrevd')
    expect(r.length).toBe(1)
    expect(r.every((f) => f.required)).toBe(true)
  })
  it('egne/arvet deler på origin', () => {
    expect(filterFields(sp, 'egne').every((f) => f.origin === 'StopPlace')).toBe(true)
    expect(filterFields(sp, 'arvet').every((f) => f.origin !== 'StopPlace')).toBe(true)
  })
})
