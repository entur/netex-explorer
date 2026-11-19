import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AiExplanation } from '../AiExplanation'
import { ElementPage } from '../ElementPage'
import { EnumPage } from '../EnumPage'
import { StructureTab } from '../StructureTab'
import { ExplanationsContext } from '../../model/explanations'
import { fixture } from '../../model/__tests__/fixture'
import type { Explanations } from '../../types'

const explanations: Explanations = {
  version: 'v2.0',
  model: 'test',
  generatedAt: 'x',
  types: { StopPlace: 'Et stoppested er …' },
  fields: { 'Zone.Name': 'Navnet på sonen.' },
  enums: { StopTypeEnumeration: 'Typer stoppested.' },
}
const LABEL = { name: 'Forklaring (KI-generert)' }

describe('AiExplanation', () => {
  it('viser etikett, tekst og merknad', () => {
    render(<AiExplanation text="En linje er …" />)
    expect(screen.getByRole('complementary', LABEL)).toHaveTextContent('En linje er …')
    expect(screen.getByText(/kan inneholde feil/)).toBeInTheDocument()
  })

  it('har overskriften «Forklaring» og en KI-generert-tag med Linje-ikonet', () => {
    const { container } = render(<AiExplanation text="En linje er …" />)
    const header = container.querySelector('.ai-explanation__header')
    expect(header).toHaveTextContent(/^ForklaringKI-generert$/)
    expect(screen.queryByRole('heading')).toBeNull()
    const icon = container.querySelector('.ai-explanation__tag svg')
    expect(icon).not.toBeNull()
    expect(icon).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('.ai-explanation__tag')).toHaveTextContent('KI-generert')
  })

  it('har lenke for å melde feil i forklaringen, utfylt med versjon og hva den gjelder', () => {
    render(
      <ExplanationsContext.Provider value={explanations}>
        <AiExplanation text="Et stoppested er …" subject="StopPlace" />
      </ExplanationsContext.Provider>,
    )
    const link = screen.getByRole('link', { name: /Meld feil i forklaringen/ })
    const url = new URL(link.getAttribute('href')!)
    expect(url.searchParams.get('template')).toBe('ki-forklaring.yml')
    expect(url.searchParams.get('versjon')).toBe('v2.0')
    expect(url.searchParams.get('gjelder')).toBe('StopPlace')
    expect(url.searchParams.get('tekst')).toBe('Et stoppested er …')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('viser ikke meld-feil-lenken uten versjon eller hva den gjelder', () => {
    render(<AiExplanation text="Et stoppested er …" subject="StopPlace" />)
    expect(screen.queryByRole('link', { name: /Meld feil/ })).toBeNull()
  })

  it('rendrer ingenting uten tekst', () => {
    const { container } = render(<AiExplanation text={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('ElementPage viser typeforklaring fra konteksten under XSD-beskrivelsen', () => {
    render(
      <ExplanationsContext.Provider value={explanations}>
        <ElementPage element="StopPlace" data={fixture} tab="felter" onTab={vi.fn()} onNavigate={vi.fn()} />
      </ExplanationsContext.Provider>,
    )
    expect(screen.getByRole('complementary', LABEL)).toHaveTextContent('Et stoppested er …')
  })

  it('ElementPage uten kontekst viser ingen boks', () => {
    render(<ElementPage element="StopPlace" data={fixture} tab="felter" onTab={vi.fn()} onNavigate={vi.fn()} />)
    expect(screen.queryByRole('complementary', LABEL)).not.toBeInTheDocument()
  })

  it('FieldDetail bruker <origin>.<navn>', async () => {
    const stopPlace = fixture.elements.find((e) => e.name === 'StopPlace')!
    render(
      <ExplanationsContext.Provider value={explanations}>
        <StructureTab element={stopPlace} data={fixture} onNavigate={vi.fn()} />
      </ExplanationsContext.Provider>,
    )
    await userEvent.click(screen.getByRole('treeitem', { name: /én av/ }))
    await userEvent.keyboard('{ArrowRight}')
    await userEvent.click(screen.getByRole('treeitem', { name: /^Name\b/ }))
    const detail = screen.getByRole('region', { name: /Detaljer for Name/ })
    expect(within(detail).getByRole('complementary', LABEL)).toHaveTextContent('Navnet på sonen.')
  })

  it('EnumPage viser enumforklaring', () => {
    render(
      <ExplanationsContext.Provider value={explanations}>
        <EnumPage enumType={fixture.enums.StopTypeEnumeration} data={fixture} onNavigate={vi.fn()} />
      </ExplanationsContext.Provider>,
    )
    expect(screen.getByRole('complementary', LABEL)).toHaveTextContent('Typer stoppested.')
  })
})
