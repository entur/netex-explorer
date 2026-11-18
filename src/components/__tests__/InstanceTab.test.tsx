import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InstanceTab } from '../InstanceTab'
import { parseXmlInstance } from '../../utils/xml-instance-parser'
import { fixture } from '../../model/__tests__/fixture'

const xml = `<PublicationDelivery><StopPlace id="NSR:StopPlace:1" version="1"><StopPlaceType>railStation</StopPlaceType></StopPlace></PublicationDelivery>`
const stopPlace = fixture.elements.find((e) => e.name === 'StopPlace')!

describe('InstanceTab', () => {
  it('viser verdiene til en instans fra lastet XML', () => {
    render(<InstanceTab element={stopPlace} loadedFile={{ filename: 'a.xml', instanceMap: parseXmlInstance(xml) }} />)
    expect(screen.getByText('StopPlaceType')).toBeInTheDocument()
    expect(screen.getAllByText('railStation').length).toBeGreaterThan(0)
  })

  it('melder når ingen instanser finnes', () => {
    render(<InstanceTab element={stopPlace} loadedFile={{ filename: 'a.xml', instanceMap: {} }} />)
    expect(screen.getByText('Ingen instanser av StopPlace funnet i a.xml')).toBeInTheDocument()
  })
})
