import { describe, it, expect } from 'vitest'
import { displayName, moduleFromPath, isSchemaFile } from '../naming.js'

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

describe('isSchemaFile', () => {
  it.each([
    ['netex_utility_types.xsd', true],
    ['netex_utility_xml.xsd', true],
    ['netex_acsb_limitations.xsd', true],
    ['netex_relationship.xsd', true],
    ['netex_ifopt_stopPlace_version.xsd', true],
    ['netex_all_objects_part1.xsd', true],
    ['README.md', false],
    ['netex_x.xsd.bak', false],
  ])('%s → %s', (name, expected) => {
    expect(isSchemaFile(name)).toBe(expected)
  })
})
