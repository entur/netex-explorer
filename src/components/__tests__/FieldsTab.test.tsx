import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { fixture } from '../../model/__tests__/fixture'
import { FieldsTab } from '../FieldsTab'
import type { Element } from '../../types'

const base = fixture.elements.find((e) => e.name === 'StopPlace')!
const element: Element = {
  ...base,
  fields: [
    {
      ...base.fields.find((f) => f.kind === 'list')!,
      name: 'things',
      contains: [
        { name: 'Quay_Dummy', minOccurs: '0', maxOccurs: '1' },
        { name: 'Ghost_Dummy', minOccurs: '0', maxOccurs: '1' },
      ],
    },
  ],
}

describe('FieldsTab _Dummy names', () => {
  it('strips the suffix, shows an «abstrakt» tag, links only when the stripped name exists', () => {
    render(<FieldsTab element={element} data={fixture} originFilter={null} onNavigate={() => {}} />)
    expect(screen.queryByText(/_Dummy/)).toBeNull()
    expect(screen.getAllByText('abstrakt')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Quay' })).toBeInTheDocument()
    expect(screen.getByText('Ghost')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ghost' })).toBeNull()
  })
})
