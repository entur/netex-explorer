import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Toolbar } from '../Toolbar'
import { REPO_URL } from '../../model/repo'

describe('Toolbar', () => {
  it('lenker til kildekoden på GitHub i ny fane', () => {
    render(<Toolbar versions={['v2.0']} version="v2.0" onVersionChange={vi.fn()} examples={[]} onFileLoaded={vi.fn()} />)
    const link = screen.getByRole('link', { name: /Kildekode på GitHub/ })
    expect(link).toHaveAttribute('href', REPO_URL)
    expect(link).toHaveAttribute('target', '_blank')
  })
})
