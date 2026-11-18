import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EnumPage } from '../EnumPage'
import { fixture } from '../../model/__tests__/fixture'

const enumType = fixture.enums.StopTypeEnumeration

describe('EnumPage', () => {
  it('viser navn, beskrivelse og alle verdier', () => {
    render(<EnumPage enumType={enumType} data={fixture} onNavigate={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'StopTypeEnumeration' })).toBeInTheDocument()
    expect(screen.getByText('Allowed values for stop place type.')).toBeInTheDocument()
    expect(screen.getByText('railStation')).toBeInTheDocument()
    expect(screen.getByText('A railway station.')).toBeInTheDocument()
    expect(screen.getByText('busStation')).toBeInTheDocument()
  })

  it('lister «Brukes av» med lenke til elementet', async () => {
    const onNavigate = vi.fn()
    render(<EnumPage enumType={enumType} data={fixture} onNavigate={onNavigate} />)
    await userEvent.click(screen.getByRole('button', { name: 'StopPlace.StopPlaceType' }))
    expect(onNavigate).toHaveBeenCalledWith({ element: 'StopPlace' })
  })
})
