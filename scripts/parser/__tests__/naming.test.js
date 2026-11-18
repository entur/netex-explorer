import { describe, it, expect } from 'vitest'
import { displayName, moduleFromPath } from '../naming.js'

describe('displayName', () => {
  it.each([
    ['StopPlace_VersionStructure', 'StopPlace'],
    ['EntityStructure', 'Entity'],
    ['DataManagedObjectStructure', 'DataManagedObject'],
    ['Quay_VersionedChildStructure', 'Quay'],
  ])('%s → %s', (typeName, expected) => {
    expect(displayName(typeName)).toBe(expected)
  })
})

describe('moduleFromPath', () => {
  it.each([
    ['xsd/netex_part_1/part1_ifopt/netex_ifopt_stopPlace_version.xsd', 'stopPlace'],
    ['xsd/netex_part_1/part1_ifopt/netex_ifopt_equipment_support.xsd', 'equipment'],
    ['xsd/netex_part_3/part3_fares/netex_fareProduct_version.xsd', 'fareProduct'],
  ])('%s → %s', (path, expected) => {
    expect(moduleFromPath(path)).toBe(expected)
  })
})
