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
