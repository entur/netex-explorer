import { describe, it, expect } from 'vitest'
import { displayName, elementLink, fieldLabel } from '../elementName'
import { fixture } from './fixture'

describe('displayName', () => {
  it('strips a trailing _Dummy and leaves other names alone', () => {
    expect(displayName('ValidityCondition_Dummy')).toBe('ValidityCondition')
    expect(displayName('Quay')).toBe('Quay')
    expect(displayName('_Dummy')).toBe('_Dummy')
  })
})

describe('elementLink', () => {
  it('links only names that are elements, never a stripped _Dummy name', () => {
    expect(elementLink('Quay', fixture)).toEqual({ label: 'Quay', target: 'Quay', members: null })
    expect(elementLink('Quay_Dummy', fixture)).toEqual({ label: 'Quay', target: null, members: null })
    expect(elementLink('Missing', fixture)).toEqual({ label: 'Missing', target: null, members: null })
  })
  it('gives the members of an abstract head from data.substitutions', () => {
    expect(elementLink('ValidityCondition_Dummy', fixture)).toEqual({
      label: 'ValidityCondition',
      target: null,
      members: ['Line', 'Quay'],
    })
  })
})

describe('fieldLabel', () => {
  it('prefixes attributes with @ and strips _Dummy from element names', () => {
    expect(fieldLabel({ name: 'id', isAttribute: true })).toBe('@id')
    expect(fieldLabel({ name: 'FarePrice_Dummy', isAttribute: false })).toBe('FarePrice')
  })
})
