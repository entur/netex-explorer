import { describe, it, expect } from 'vitest'
import { displayName } from '../naming.js'

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
