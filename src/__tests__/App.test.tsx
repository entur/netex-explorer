import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import App from '../App'
import { fixture } from '../model/__tests__/fixture'
import type { Explanations, VersionData } from '../types'

const v13: VersionData = {
  ...fixture,
  version: 'v1.3',
  elements: fixture.elements.filter((e) => e.name !== 'StopPlace'),
}

const manifest = {
  generatedAt: 'x',
  versions: [
    { version: 'v2.0', file: 'netex-v2.0.json', elementCount: 5, enumCount: 1, fetchedAt: 'x' },
    { version: 'v1.3', file: 'netex-v1.3.json', elementCount: 4, enumCount: 1, fetchedAt: 'x' },
    { version: 'v9.9', error: 'boom' },
  ],
}

function explanationsFor(version: string): Explanations {
  return { version, model: 'test', generatedAt: 'x', types: { StopPlace: 'KI om stoppested', Quay: 'KI om plattform' }, fields: {}, enums: {} }
}

function mockFetch(explanations: (url: string) => Promise<Response> | null = () => null) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.includes('explanations-')) {
        return (
          explanations(url) ??
          (({ ok: false, status: 404, json: async () => ({}) }) as Response)
        )
      }
      const body = url.endsWith('versions.json')
        ? manifest
        : url.endsWith('netex-v2.0.json')
          ? fixture
          : url.endsWith('netex-v1.3.json')
            ? v13
            : null
      return body
        ? ({ ok: true, status: 200, json: async () => body } as Response)
        : ({ ok: false, status: 404, json: async () => ({}) } as Response)
    }),
  )
}

describe('App', () => {
  beforeEach(() => {
    mockFetch()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    window.history.replaceState(null, '', '/')
  })

  it('viser melding for ukjent element', async () => {
    window.history.replaceState(null, '', '/?element=Finnesikke')
    render(<App />)
    expect(await screen.findByText('Finnesikke finnes ikke i v2.0')).toBeInTheDocument()
    expect(screen.getByLabelText('Søk')).toBeInTheDocument()
  })

  it('viser enum-siden for ?enum=', async () => {
    window.history.replaceState(null, '', '/?enum=StopTypeEnumeration')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'StopTypeEnumeration' })).toBeInTheDocument()
    expect(screen.getByText('railStation')).toBeInTheDocument()
  })

  it('viser elementnavn og modulgrupper', async () => {
    window.history.replaceState(null, '', '/?element=StopPlace')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'StopPlace' })).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Elementer' })).getByText('Stop place')).toBeInTheDocument()
  })

  it('versjonsbytte der elementet mangler viser melding og beholder sidepanelet', async () => {
    window.history.replaceState(null, '', '/?element=StopPlace')
    render(<App />)
    await screen.findByRole('heading', { name: 'StopPlace' })
    await waitFor(() => expect(screen.getByRole('combobox', { name: /Versjon/ })).toBeInTheDocument())
    await userEvent.click(screen.getByRole('combobox', { name: /Versjon/ }))
    await userEvent.click(await screen.findByRole('option', { name: 'v1.3' }))
    expect(await screen.findByText('StopPlace finnes ikke i v1.3')).toBeInTheDocument()
    expect(screen.getByLabelText('Søk')).toBeInTheDocument()
    expect(window.location.search).toBe('?v=v1.3&element=StopPlace')
  })

  it('popstate leses', async () => {
    render(<App />)
    await screen.findByLabelText('Søk')
    await act(async () => {
      window.history.pushState(null, '', '/?element=Nope')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(await screen.findByText('Nope finnes ikke i v2.0')).toBeInTheDocument()
  })

  it('søk erstatter listen med grupperte treff', async () => {
    render(<App />)
    const box = await screen.findByLabelText('Søk')
    await screen.findByText('Stop place')
    await userEvent.type(box, 'quays')
    const nav = screen.getByRole('navigation', { name: 'Elementer' })
    expect(within(nav).getByText('Felter')).toBeInTheDocument()
    expect(within(nav).getByText('quays · fra StopPlace')).toBeInTheDocument()
  })

  it('viser feil når lasting feiler', async () => {
    window.history.replaceState(null, '', '/?v=v9.9')
    render(<App />)
    expect(await screen.findByText('Kunne ikke laste data for v9.9')).toBeInTheDocument()
  })

  it('App virker når forklaringsfilen gir 404', async () => {
    window.history.replaceState(null, '', '/?element=StopPlace')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'StopPlace' })).toBeInTheDocument()
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('explanations-v2.0.json')))
    expect(screen.queryByRole('complementary', { name: 'Forklaring (KI-generert)' })).not.toBeInTheDocument()
    expect(screen.queryByText('Kunne ikke laste data', { exact: false })).not.toBeInTheDocument()
  })

  it('App viser forklaring når filen finnes', async () => {
    mockFetch((url) =>
      url.endsWith('explanations-v2.0.json')
        ? Promise.resolve({ ok: true, status: 200, json: async () => explanationsFor('v2.0') } as Response)
        : null,
    )
    window.history.replaceState(null, '', '/?element=StopPlace')
    render(<App />)
    expect(await screen.findByRole('complementary', { name: 'Forklaring (KI-generert)' })).toHaveTextContent(
      'KI om stoppested',
    )
  })

  it('App viser ikke forrige versjons forklaringer etter versjonsbytte', async () => {
    mockFetch((url) =>
      url.endsWith('explanations-v2.0.json')
        ? Promise.resolve({ ok: true, status: 200, json: async () => explanationsFor('v2.0') } as Response)
        : url.endsWith('explanations-v1.3.json')
          ? new Promise<Response>(() => {})
          : null,
    )
    window.history.replaceState(null, '', '/?element=Quay')
    render(<App />)
    await screen.findByRole('heading', { name: 'Quay' })
    expect(await screen.findByRole('complementary', { name: 'Forklaring (KI-generert)' })).toHaveTextContent('KI om plattform')
    await userEvent.click(await screen.findByRole('combobox', { name: /Versjon/ }))
    await userEvent.click(await screen.findByRole('option', { name: 'v1.3' }))
    await waitFor(() => expect(window.location.search).toContain('v=v1.3'))
    expect(await screen.findByRole('heading', { name: 'Quay' })).toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: 'Forklaring (KI-generert)' })).not.toBeInTheDocument()
  })
})
