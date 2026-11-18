import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ElementPage } from '../ElementPage'
import { EnumValueList } from '../EnumValueList'
import { fixture } from '../../model/__tests__/fixture'

function setup(over: Partial<Parameters<typeof ElementPage>[0]> = {}) {
  const onNavigate = vi.fn()
  const onTab = vi.fn()
  render(<ElementPage element="StopPlace" data={fixture} tab="felter" onTab={onTab} onNavigate={onNavigate} {...over} />)
  return { onNavigate, onTab }
}

describe('FieldsTab', () => {
  it('chip «Enums» viser bare enum-rader', async () => {
    setup()
    await userEvent.click(screen.getByRole('checkbox', { name: /Enums/ }))
    expect(screen.getByText('StopPlaceType')).toBeInTheDocument()
    expect(screen.queryByText('quays')).not.toBeInTheDocument()
  })

  it('utfolding viser verdi og beskrivelse', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /verdier for StopPlaceType/ }))
    expect(screen.getByText('railStation')).toBeInTheDocument()
    expect(screen.getByText('A railway station.')).toBeInTheDocument()
  })

  it('manglende enum gir melding', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /verdier for Mystery/ }))
    expect(screen.getByText('Ingen verdier funnet i XSD-en')).toBeInTheDocument()
  })

  it('ref til mål som ikke finnes i elements er vanlig tekst (Ruling 9)', () => {
    setup()
    const row = screen.getByText('SiteRef').closest('tr')!
    expect(within(row).getAllByText('Site').length).toBeGreaterThan(0)
    expect(within(row).queryByRole('button', { name: 'Site' })).not.toBeInTheDocument()
  })

  it('liste-innhold lenker bare til eksisterende elementer', async () => {
    const { onNavigate } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Quay' }))
    expect(onNavigate).toHaveBeenCalledWith({ element: 'Quay' })
    expect(screen.queryByRole('button', { name: 'QuayRef' })).not.toBeInTheDocument()
  })

  it('påkrevd har skjult tekst', () => {
    setup()
    expect(screen.getAllByText('påkrevd').length).toBe(1)
  })
})

describe('AncestorPills', () => {
  it('abstrakt pille filtrerer på origin, Vis alle fjerner', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Entity' }))
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows.length).toBe(2)
    rows.forEach((r) => expect(within(r).getAllByRole('cell').at(-1)).toHaveTextContent('Entity'))
    await userEvent.click(screen.getByRole('button', { name: 'Vis alle' }))
    expect(screen.getAllByRole('row').length).toBe(10)
  })

  it('konkret pille navigerer', async () => {
    // Zone finnes ikke i elements og filtrerer; bruk Quay-ancestor-løs sjekk via Entity-klasse
    const data = { ...fixture, elements: [...fixture.elements, { ...fixture.elements[3], name: 'Zone', abstract: false }] }
    const { onNavigate } = setup({ data })
    await userEvent.click(screen.getByRole('button', { name: 'Zone' }))
    expect(onNavigate).toHaveBeenCalledWith({ element: 'Zone' })
  })
})

describe('tabs', () => {
  it('XML-instans er deaktivert uten fil', () => {
    setup()
    expect(screen.getByRole('tab', { name: 'XML-instans' })).toBeDisabled()
  })
})

describe('xml-fane uten fil', () => {
  it('viser Felter-fanen', () => {
    setup({ tab: 'xml' })
    expect(screen.getByRole('tab', { name: 'Felter' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('checkbox', { name: /Alle/ })).toBeInTheDocument()
  })
})

describe('EnumValueList', () => {
  it('viser melding når enum mangler', () => {
    render(<EnumValueList typeName="X" />)
    expect(screen.getByText('Ingen verdier funnet i XSD-en')).toBeInTheDocument()
  })
})
