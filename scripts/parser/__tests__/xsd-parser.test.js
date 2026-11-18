import { describe, it, expect } from 'vitest'
import { parseXsd } from '../xsd-parser.js'

const wrap = (body) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">${body}</xsd:schema>`

describe('parseXsd', () => {
  it('extracts elements with substitutionGroup, abstract and description', () => {
    const { elements } = parseXsd(wrap(`
      <xsd:element name="Dummy" abstract="true"/>
      <xsd:element name="Product" substitutionGroup="Dummy" type="ProductStructure">
        <xsd:annotation><xsd:documentation>A PRODUCT.</xsd:documentation></xsd:annotation>
      </xsd:element>`))
    expect(elements.get('Dummy')).toMatchObject({ abstract: true, description: '', inlineType: null })
    expect(elements.get('Product')).toMatchObject({
      abstract: false,
      substitutionGroup: 'Dummy',
      type: 'ProductStructure',
      description: 'A PRODUCT.',
    })
  })

  it('keeps sequence order across groups and inline elements', () => {
    const { types } = parseXsd(wrap(`
      <xsd:complexType name="T">
        <xsd:complexContent>
          <xsd:extension base="Base">
            <xsd:sequence>
              <xsd:group ref="AGroup"/>
              <xsd:element name="X"/>
              <xsd:group ref="BGroup"/>
            </xsd:sequence>
          </xsd:extension>
        </xsd:complexContent>
      </xsd:complexType>`))
    const t = types.get('T')
    expect(t.content.map((p) => (p.kind === 'group' ? p.ref : p.name))).toEqual(['AGroup', 'X', 'BGroup'])
    expect(t).toMatchObject({ base: 'Base', derivation: 'extension' })
  })

  it('parses choice with cardinality', () => {
    const { groups } = parseXsd(wrap(`
      <xsd:group name="G">
        <xsd:sequence>
          <xsd:choice minOccurs="0" maxOccurs="unbounded">
            <xsd:annotation><xsd:documentation>ignored</xsd:documentation></xsd:annotation>
            <xsd:element ref="QuayRef"/>
            <xsd:element ref="Quay"/>
          </xsd:choice>
        </xsd:sequence>
      </xsd:group>`))
    const { content } = groups.get('G')
    expect(content).toHaveLength(1)
    expect(content[0]).toMatchObject({ kind: 'choice', minOccurs: '0', maxOccurs: 'unbounded' })
    expect(content[0].content).toMatchObject([
      { kind: 'element', name: 'QuayRef', ref: true },
      { kind: 'element', name: 'Quay', ref: true },
    ])
  })

  it('keeps nested sequences and defaults occurrences to 1', () => {
    const { groups } = parseXsd(wrap(`
      <xsd:group name="G">
        <xsd:sequence>
          <xsd:element name="A" type="xsd:string"/>
          <xsd:sequence minOccurs="0"><xsd:element name="B"/></xsd:sequence>
        </xsd:sequence>
      </xsd:group>`))
    const [a, seq] = groups.get('G').content
    expect(a).toMatchObject({ kind: 'element', name: 'A', ref: false, type: 'xsd:string', minOccurs: '1', maxOccurs: '1', description: '' })
    expect(seq).toMatchObject({ kind: 'sequence', minOccurs: '0', content: [{ name: 'B', type: null }] })
  })

  it('parses group-level minOccurs', () => {
    const { types } = parseXsd(wrap(`
      <xsd:complexType name="T">
        <xsd:sequence><xsd:group ref="EntityInVersionGroup" minOccurs="0"/></xsd:sequence>
      </xsd:complexType>`))
    expect(types.get('T').content[0]).toEqual({ kind: 'group', ref: 'EntityInVersionGroup', minOccurs: '0', maxOccurs: '1' })
    expect(types.get('T').base).toBeNull()
  })

  it('parses attributes with use', () => {
    const { types } = parseXsd(wrap(`
      <xsd:complexType name="T">
        <xsd:complexContent>
          <xsd:extension base="B">
            <xsd:sequence/>
            <xsd:attribute name="id" type="StopPlaceIdType" use="required"/>
            <xsd:attribute name="order" type="xsd:integer"/>
          </xsd:extension>
        </xsd:complexContent>
      </xsd:complexType>`))
    expect(types.get('T').attributes).toMatchObject([
      { name: 'id', type: 'StopPlaceIdType', use: 'required' },
      { name: 'order', type: 'xsd:integer', use: 'optional' },
    ])
  })

  it('parses inline element type as restriction', () => {
    const { elements } = parseXsd(wrap(`
      <xsd:element name="StopPlace">
        <xsd:complexType>
          <xsd:complexContent>
            <xsd:restriction base="StopPlace_VersionStructure">
              <xsd:sequence><xsd:group ref="StopPlaceGroup"/></xsd:sequence>
            </xsd:restriction>
          </xsd:complexContent>
        </xsd:complexType>
      </xsd:element>`))
    const inline = elements.get('StopPlace').inlineType
    expect(inline.base).toBe('StopPlace_VersionStructure')
    expect(inline.derivation).toBe('restriction')
    expect(inline.content[0]).toMatchObject({ kind: 'group', ref: 'StopPlaceGroup' })
  })

  it('parses enums with value descriptions', () => {
    const { enums } = parseXsd(wrap(`
      <xsd:simpleType name="AllModesEnumeration">
        <xsd:annotation><xsd:documentation>Modes.</xsd:documentation></xsd:annotation>
        <xsd:restriction base="xsd:string">
          <xsd:enumeration value="all">
            <xsd:annotation><xsd:documentation>If all modes are meant.</xsd:documentation></xsd:annotation>
          </xsd:enumeration>
          <xsd:enumeration value="bus"/>
        </xsd:restriction>
      </xsd:simpleType>`))
    const e = enums.get('AllModesEnumeration')
    expect(e.description).toBe('Modes.')
    expect(e.values).toEqual([
      { value: 'all', description: 'If all modes are meant.' },
      { value: 'bus', description: '' },
    ])
  })

  it('parses list simpleType', () => {
    const { listTypes, enums } = parseXsd(wrap(`
      <xsd:simpleType name="AllPublicTransportModesListOfEnumerations">
        <xsd:list itemType="AllPublicTransportModesEnumeration"/>
      </xsd:simpleType>`))
    expect(listTypes.get('AllPublicTransportModesListOfEnumerations')).toBe('AllPublicTransportModesEnumeration')
    expect(enums.size).toBe(0)
  })

  it('records source path on elements', () => {
    const { elements } = parseXsd(wrap('<xsd:element name="N"/>'), 'xsd/a/netex_b_c_version.xsd')
    expect(elements.get('N').source).toBe('xsd/a/netex_b_c_version.xsd')
  })
  it('collects attribute groups and attributeGroup refs on types', () => {
    const { attributeGroups, types } = parseXsd(wrap(`
      <xsd:attributeGroup name="DetailsGroup">
        <xsd:attribute name="version" type="xsd:string" use="optional"/>
        <xsd:attributeGroup ref="InnerGroup"/>
      </xsd:attributeGroup>
      <xsd:attributeGroup name="InnerGroup"><xsd:attribute name="created" type="xsd:dateTime"/></xsd:attributeGroup>
      <xsd:complexType name="T">
        <xsd:complexContent>
          <xsd:extension base="B"><xsd:attributeGroup ref="DetailsGroup"/></xsd:extension>
        </xsd:complexContent>
      </xsd:complexType>
      <xsd:complexType name="S">
        <xsd:simpleContent><xsd:extension base="xsd:string"><xsd:attributeGroup ref="InnerGroup"/></xsd:extension></xsd:simpleContent>
      </xsd:complexType>`))
    expect(attributeGroups.get('DetailsGroup')).toMatchObject({
      attributes: [{ name: 'version' }],
      attributeGroupRefs: ['InnerGroup'],
    })
    expect(attributeGroups.get('InnerGroup').attributes[0].name).toBe('created')
    expect(types.get('T').attributeGroupRefs).toEqual(['DetailsGroup'])
    expect(types.get('S').attributeGroupRefs).toEqual(['InnerGroup'])
  })

  it('keeps use="prohibited"', () => {
    const { types } = parseXsd(wrap(`
      <xsd:complexType name="T"><xsd:attribute name="a" type="xsd:string" use="prohibited"/></xsd:complexType>`))
    expect(types.get('T').attributes[0].use).toBe('prohibited')
  })
})
