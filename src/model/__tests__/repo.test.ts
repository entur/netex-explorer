import { describe, expect, it } from 'vitest'
import { REPO_URL, explanationIssueUrl } from '../repo'

describe('explanationIssueUrl', () => {
  it('peker på malen for KI-forklaringer i repoet', () => {
    const url = new URL(explanationIssueUrl({ version: 'v2.0', subject: 'StopPlace', text: 'Et stoppested.' }))
    expect(`${url.origin}${url.pathname}`).toBe(`${REPO_URL}/issues/new`)
    expect(url.searchParams.get('template')).toBe('ki-forklaring.yml')
  })

  it('fyller ut tittel, versjon, hva den gjelder og teksten', () => {
    const url = new URL(
      explanationIssueUrl({ version: 'v2.1-wip', subject: 'GroupOfEntities.Name', text: 'Navnet & «tittelen» #1?' }),
    )
    expect(url.searchParams.get('title')).toBe('Feil i KI-forklaring: GroupOfEntities.Name (v2.1-wip)')
    expect(url.searchParams.get('versjon')).toBe('v2.1-wip')
    expect(url.searchParams.get('gjelder')).toBe('GroupOfEntities.Name')
    expect(url.searchParams.get('tekst')).toBe('Navnet & «tittelen» #1?')
  })
})
