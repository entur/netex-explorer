import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fixture } from '../../model/__tests__/fixture'
import { FieldsTab } from '../FieldsTab'
import type { Element } from '../../types'

const fareZone = fixture.elements.find((e) => e.name === 'FareZone')!
const stopPlace = fixture.elements.find((e) => e.name === 'StopPlace')!

function setup(element: Element = fareZone, onNavigate = vi.fn()) {
  render(<FieldsTab element={element} data={fixture} originFilter={null} onNavigate={onNavigate} />)
  return onNavigate
}
const row = (name: string) => screen.getByText(name, { selector: '.fields-tab__name' }).closest('tr') as HTMLElement

describe('FieldsTab attributes', () => {
  it('shows attributes with @ and their real kind', () => {
    setup()
    expect(row('@id')).toBeInTheDocument()
    const status = row('@status')
    expect(status.querySelector('.kind-badge')).toHaveTextContent('@enum')
    expect(within(status).getByRole('button', { name: 'StopTypeEnumeration' })).toBeInTheDocument()
  })
})

describe('FieldsTab unknown types', () => {
  it('shows «ukjent» and the type without a link', () => {
    setup()
    const area = row('Area')
    expect(area.querySelector('.kind-badge')).toHaveTextContent('ukjent')
    expect(within(area).getByText('gml:PolygonType')).toBeInTheDocument()
    expect(within(area).queryAllByRole('button')).toHaveLength(0)
  })
})

describe('FieldsTab abstract heads and element refs', () => {
  it('lists the members of a head in contains as links, never shows _Dummy', async () => {
    const user = userEvent.setup()
    const onNavigate = setup()
    expect(screen.queryByText(/_Dummy/)).toBeNull()
    const vc = row('validityConditions')
    expect(within(vc).getByText('ValidityCondition')).toBeInTheDocument()
    expect(within(vc).getByText('abstrakt')).toBeInTheDocument()
    expect(within(vc).getByText(/én av 2/)).toBeInTheDocument()
    await user.click(within(vc).getByRole('button', { name: 'Quay' }))
    expect(onNavigate).toHaveBeenCalledWith({ element: 'Quay' })
  })

  it('local contains entries and unknown refs are plain text', () => {
    setup()
    const vc = row('validityConditions')
    for (const name of ['Extra', 'Plain', 'Ghost']) {
      expect(within(vc).getByText(name)).toBeInTheDocument()
      expect(within(vc).queryByRole('button', { name })).toBeNull()
    }
  })

  it('a field whose own name is a head shows the stripped name and its members', () => {
    setup()
    const head = row('TariffZoneRef')
    expect(within(head).getAllByText('abstrakt').length).toBeGreaterThan(0)
    expect(within(head).getByRole('button', { name: 'Line' })).toBeInTheDocument()
  })

  it('an element ref with a complex type links to the element', async () => {
    const user = userEvent.setup()
    const onNavigate = setup()
    await user.click(within(row('FareProduct')).getByRole('button', { name: 'FareProduct' }))
    expect(onNavigate).toHaveBeenCalledWith({ element: 'FareProduct' })
  })

  it('never links a stripped _Dummy name to the concrete element', () => {
    const element: Element = {
      ...stopPlace,
      fields: [{ ...stopPlace.fields.find((f) => f.kind === 'list')!, name: 'things', contains: [{ name: 'Quay_Dummy', minOccurs: '0', maxOccurs: '1', ref: true }] }],
    }
    setup(element)
    expect(within(row('things')).getByText('Quay')).toBeInTheDocument()
    expect(within(row('things')).queryByRole('button', { name: 'Quay' })).toBeNull()
  })
})
