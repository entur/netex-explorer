import { describe, it, expect } from 'vitest'
import { readUrlState, toSearch } from '../urlState'

describe('urlState', () => {
  it('rundtur beholder ikke-standardverdier', () => {
    expect(toSearch(readUrlState('?element=StopPlace&tab=struktur'))).toBe('?element=StopPlace&tab=struktur')
  })
  it('har standardverdier', () => {
    expect(readUrlState('')).toEqual({ v: 'v2.0', element: undefined, enum: undefined, tab: 'felter' })
  })
  it('utelater standardverdier', () => {
    expect(toSearch({ v: 'v2.0', tab: 'felter' })).toBe('')
    expect(toSearch({ v: 'v1.3', enum: 'X', tab: 'felter' })).toBe('?v=v1.3&enum=X')
  })
  it('ukjent tab gir felter', () => {
    expect(readUrlState('?tab=tull').tab).toBe('felter')
  })
})
