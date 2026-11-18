import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fixture } from '../../model/__tests__/fixture'
import { StructureTab } from '../StructureTab'

const stopPlace = fixture.elements.find((e) => e.name === 'StopPlace')!

function setup(onNavigate: (t: { element: string } | { enum: string }) => void = () => {}) {
  render(<StructureTab element={stopPlace} data={fixture} onNavigate={onNavigate} />)
}

describe('StructureTab', () => {
  it('ArrowRight on quays expands it', async () => {
    const user = userEvent.setup()
    setup()
    const quays = screen.getByRole('treeitem', { name: /quays/ })
    expect(quays).toHaveAttribute('aria-expanded', 'false')
    await user.click(quays)
    await user.keyboard('{ArrowRight}')
    expect(quays).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('treeitem', { name: /^Quay\b/ })).toBeInTheDocument()
    expect(screen.getByRole('treeitem', { name: /QuayRef/ })).toBeInTheDocument()
    // Right again moves to first child, Left goes back to parent, Left collapses
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('treeitem', { name: /QuayRef/ })).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(quays).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(quays).toHaveAttribute('aria-expanded', 'false')
  })

  it('clicking StopPlaceType shows FieldDetail with enum values', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('treeitem', { name: /StopPlaceType/ }))
    expect(screen.getByText('railStation')).toBeInTheDocument()
  })

  it('ArrowDown moves focus, skipping dividers', async () => {
    const user = userEvent.setup()
    setup()
    await user.tab()
    const first = screen.getAllByRole('treeitem')[0]
    expect(first).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getAllByRole('treeitem')[1]).toHaveFocus()
  })

  it('cycle node is a link that navigates', async () => {
    const user = userEvent.setup()
    const calls: unknown[] = []
    setup((t) => calls.push(t))
    await user.click(screen.getByRole('treeitem', { name: /quays/ }))
    await user.keyboard('{ArrowRight}')
    await user.click(screen.getByRole('treeitem', { name: /^Quay\b/ }))
    await user.keyboard('{ArrowRight}') // expand Quay
    // Quay -> quays (list) -> Quay (cycle)
    const innerQuays = screen.getAllByRole('treeitem', { name: /quays/ })[1]
    await user.click(innerQuays)
    await user.keyboard('{ArrowRight}')
    await user.click(screen.getByRole('button', { name: /Quay.*syklus/ }))
    expect(calls).toEqual([{ element: 'Quay' }])
  })

  it('Enter on a focused cycle row navigates to that element', async () => {
    const user = userEvent.setup()
    const calls: unknown[] = []
    setup((t) => calls.push(t))
    await user.click(screen.getByRole('treeitem', { name: /quays/ }))
    await user.keyboard('{ArrowRight}')
    await user.click(screen.getByRole('treeitem', { name: /^Quay\b/ }))
    await user.keyboard('{ArrowRight}') // Quay expanded
    await user.click(screen.getAllByRole('treeitem', { name: /quays/ })[1])
    await user.keyboard('{ArrowRight}{ArrowDown}')
    const cycle = screen.getByRole('button', { name: /syklus/ }).closest('[role="treeitem"]') as HTMLElement
    expect(cycle).toHaveFocus()
    expect(screen.getByRole('button', { name: /syklus/ })).toHaveAttribute('tabindex', '-1')
    await user.keyboard('{Enter}')
    expect(calls).toEqual([{ element: 'Quay' }])
  })
})

describe('StructureTab heads, local elements, attributes and unknown types', () => {
  const fareZone = fixture.elements.find((e) => e.name === 'FareZone')!
  function setupZone(onNavigate: (t: { element: string } | { enum: string }) => void = () => {}) {
    render(<StructureTab element={fareZone} data={fixture} onNavigate={onNavigate} />)
  }

  it('shows @ for attributes and never _Dummy', () => {
    setupZone()
    expect(screen.getByRole('treeitem', { name: /^@status/ })).toBeInTheDocument()
    expect(screen.getByRole('treeitem', { name: /^TariffZoneRef\b/ })).toBeInTheDocument()
    expect(screen.queryByText(/_Dummy/)).toBeNull()
  })

  it('a head in contains shows «abstrakt · én av N» and expands to its members', async () => {
    const user = userEvent.setup()
    setupZone()
    await user.click(screen.getByRole('treeitem', { name: /validityConditions/ }))
    await user.keyboard('{ArrowRight}')
    const head = screen.getByRole('treeitem', { name: /^ValidityCondition.*abstrakt.*én av 2/ })
    await user.click(head)
    await user.keyboard('{ArrowRight}')
    expect(head).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('treeitem', { name: /^Line\b/ })).toBeInTheDocument()
    expect(screen.getByRole('treeitem', { name: /^Quay\b/ })).toBeInTheDocument()
  })

  it('a local element in contains expands to the fields of its type', async () => {
    const user = userEvent.setup()
    setupZone()
    await user.click(screen.getByRole('treeitem', { name: /validityConditions/ }))
    await user.keyboard('{ArrowRight}')
    const extra = screen.getByRole('treeitem', { name: /^Extra\b/ })
    await user.click(extra)
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('treeitem', { name: /^KeyValue\b/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Åpne Extra/ })).toBeNull()
  })

  it('detail card: unknown type, head members and element ref link', async () => {
    const user = userEvent.setup()
    const calls: unknown[] = []
    setupZone((t) => calls.push(t))
    await user.click(screen.getByRole('treeitem', { name: /^Area\b/ }))
    expect(screen.getByText('Typen finnes ikke i XSD-filene som er lest inn')).toBeInTheDocument()
    await user.click(screen.getByRole('treeitem', { name: /^TariffZoneRef\b/ }))
    await user.click(screen.getByRole('button', { name: 'Line' }))
    expect(calls).toEqual([{ element: 'Line' }])
    await user.click(screen.getByRole('treeitem', { name: /^FareProduct\b/ }))
    await user.click(screen.getByRole('button', { name: 'FareProduct' }))
    expect(calls).toEqual([{ element: 'Line' }, { element: 'FareProduct' }])
  })

  it('a field that refs a concrete element expands to the element fields', async () => {
    const user = userEvent.setup()
    setupZone()
    const fp = screen.getByRole('treeitem', { name: /^FareProduct\b/ })
    await user.click(fp)
    await user.keyboard('{ArrowRight}')
    expect(fp).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('treeitem', { name: /^@id\b/ }).length).toBe(2)
  })
})

