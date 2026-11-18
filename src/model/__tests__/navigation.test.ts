import { describe, it, expect } from 'vitest'
import { groupByModule, humanizeModule } from '../navigation'
import { fixture } from './fixture'

describe('navigation', () => {
  it('humanizeModule', () => {
    expect(humanizeModule('stopPlace')).toBe('Stop place')
    expect(humanizeModule('fare')).toBe('Fare')
  })
  it('part 1 gir bare del 1, gruppert og sortert', () => {
    const g = groupByModule(fixture.elements, 1)
    expect(g.map((x) => x.label)).toEqual(['Line', 'Stop place'])
    expect(g[1].elements.map((e) => e.name)).toEqual(['Quay', 'StopPlace'])
    expect(g.flatMap((x) => x.elements).every((e) => e.part === 1)).toBe(true)
  })
  it('alle gir alle deler', () => {
    expect(groupByModule(fixture.elements, 'alle').flatMap((x) => x.elements)).toHaveLength(fixture.elements.length)
  })
})
