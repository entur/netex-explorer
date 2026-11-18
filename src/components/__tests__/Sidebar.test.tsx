import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
