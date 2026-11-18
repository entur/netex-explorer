import { describe, it, expect } from 'vitest'
import { partName } from '../parts'

describe('partName', () => {
  it('maps parts 0-3 to names', () => {
    expect(partName(0)).toEqual({ label: 'Rammeverk', full: 'NeTEx rammeverk (felles grunnstrukturer)' })
    expect(partName(1).label).toBe('Nettverk')
    expect(partName(2).full).toBe('NeTEx del 2 – rutetider')
    expect(partName(3).label).toBe('Takstdata')
  })
  it('falls back to «Del N»', () => {
    expect(partName(7)).toEqual({ label: 'Del 7', full: 'Del 7' })
  })
})
