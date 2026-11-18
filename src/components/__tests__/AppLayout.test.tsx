import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppLayout } from '../AppLayout'

describe('AppLayout', () => {
  it('has a slim title bar linking to the app root, not a heading', () => {
    render(
      <AppLayout sidebar={<p>side</p>}>
        <h1>Innhold</h1>
      </AppLayout>,
    )
    const link = screen.getByRole('link', { name: 'Entur NeTEx-utforsker' })
    expect(link).toHaveAttribute('href', import.meta.env.BASE_URL)
    expect(link.closest('h1, h2, h3')).toBeNull()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
})
