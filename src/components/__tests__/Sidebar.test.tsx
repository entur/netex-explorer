import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fixture } from '../../model/__tests__/fixture'
import { Sidebar } from '../Sidebar'

function setup(state: { element?: string; enum?: string } = {}, onNavigate = vi.fn()) {
  render(<Sidebar data={fixture} state={{ v: fixture.version, tab: 'felter', ...state } as never} onNavigate={onNavigate} />)
  return onNavigate
}

describe('Sidebar list toggle', () => {
  it('is expanded without a selection and exposes aria-expanded/aria-controls', () => {
    setup()
    const btn = screen.getByRole('button', { name: /elementliste/i })
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById(btn.getAttribute('aria-controls')!)).not.toBeNull()
  })

  it('is collapsed by default when an element is selected, and toggles', async () => {
    const user = userEvent.setup()
    setup({ element: 'StopPlace' })
    const btn = screen.getByRole('button', { name: 'Vis elementliste' })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    await user.click(btn)
    expect(screen.getByRole('button', { name: 'Skjul elementliste' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('collapses when an item is selected', async () => {
    const user = userEvent.setup()
    const onNavigate = setup()
    await user.click(screen.getByRole('button', { name: 'Stop place' }))
    await user.click(await screen.findByRole('link', { name: 'Quay' }))
    expect(onNavigate).toHaveBeenCalledWith({ element: 'Quay' })
    expect(screen.getByRole('button', { name: 'Vis elementliste' })).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('Sidebar search on narrow screens', () => {
  it('opens the collapsed list when a query is typed, so results are visible', async () => {
    const user = userEvent.setup()
    setup({ element: 'StopPlace' })
    expect(screen.getByRole('button', { name: 'Vis elementliste' })).toHaveAttribute('aria-expanded', 'false')
    await user.type(screen.getByLabelText('Søk'), 'Quay')
    expect(screen.getByRole('button', { name: 'Skjul elementliste' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Quay' })).toBeInTheDocument()
  })

  it('opens the collapsed list when the part filter changes', async () => {
    const user = userEvent.setup()
    setup({ element: 'StopPlace' })
    await user.click(screen.getByRole('radio', { name: /Takstdata/ }))
    expect(screen.getByRole('button', { name: 'Skjul elementliste' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('shows attribute hits with @', async () => {
    const user = userEvent.setup()
    setup()
    await user.type(screen.getByLabelText('Søk'), 'status')
    expect(screen.getByRole('link', { name: /^@status · fra Entity/ })).toBeInTheDocument()
  })
})

describe('Sidebar part filter', () => {
  it('is a single-select group of choice chips, «Alle» first, with full names as accessible names', async () => {
    const user = userEvent.setup()
    setup()
    const group = screen.getByRole('group', { name: 'Del' })
    const radios = within(group).getAllByRole('radio')
    expect(radios.map((r) => r.getAttribute('value'))).toEqual(['alle', '0', '1', '2', '3'])
    expect(radios[0]).toBeChecked()
    await user.click(screen.getByRole('radio', { name: /Takstdata – NeTEx del 3/ }))
    expect(screen.getByRole('radio', { name: /Takstdata/ })).toBeChecked()
    expect(radios[0]).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Fare product' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Stop place' })).toBeNull()
  })
})
