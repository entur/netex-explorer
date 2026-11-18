import { describe, it, expect } from 'vitest'
import { elementDisplay } from '../elementName'
import { fixture } from './fixture'

describe('elementDisplay', () => {
  it('strips _Dummy, marks abstract and links when the stripped name exists', () => {
    expect(elementDisplay('Quay_Dummy', fixture)).toEqual({ label: 'Quay', abstract: true, target: 'Quay' })
  })
  it('has no target when the stripped name is not in data.elements', () => {
    expect(elementDisplay('Nope_Dummy', fixture)).toEqual({ label: 'Nope', abstract: true, target: null })
  })
  it('leaves ordinary names alone', () => {
    expect(elementDisplay('Quay', fixture)).toEqual({ label: 'Quay', abstract: false, target: 'Quay' })
    expect(elementDisplay('Missing', fixture)).toEqual({ label: 'Missing', abstract: false, target: null })
  })
})
