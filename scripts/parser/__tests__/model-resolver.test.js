import { describe, it, expect } from 'vitest'
import { parseXsd } from '../xsd-parser.js'
import { resolveElement } from '../model-resolver.js'

const wrap = (body) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">${body}</xsd:schema>`

/** Parses each XSD body and merges the maps into one context, like the pipeline does. */
function context(...bodies) {
  const ctx = { elements: new Map(), types: new Map(), groups: new Map(), enums: new Map(), listTypes: new Map() }
  for (const body of bodies) {
    const parsed = parseXsd(wrap(body))
    for (const key of Object.keys(ctx)) for (const [k, v] of parsed[key]) ctx[key].set(k, v)
  }
  return ctx
}

const ext = (name, base, inner = '', attrs = '') => `
  <xsd:complexType name="${name}">
    <xsd:complexContent>
      <xsd:extension base="${base}">
        <xsd:sequence>${inner}</xsd:sequence>
        ${attrs}
      </xsd:extension>
    </xsd:complexContent>
  </xsd:complexType>`

const group = (name, inner) => `<xsd:group name="${name}"><xsd:sequence>${inner}</xsd:sequence></xsd:group>`

/** Entity ← EntityInVersion ← DataManagedObject ← GroupOfEntities ← Site ← StopPlace */
const FRAMEWORK = `
  <xsd:element name="Entity" type="EntityStructure" abstract="true"/>
  <xsd:complexType name="EntityStructure" abstract="true">
    <xsd:attribute name="id" type="ObjectIdType" use="optional"/>
  </xsd:complexType>
  ${ext('EntityInVersionStructure', 'EntityStructure', '<xsd:group ref="EntityInVersionGroup"/>', '<xsd:attribute name="version" type="xsd:string"/>')}
  ${group('EntityInVersionGroup', '<xsd:element name="validityConditions" type="validityConditions_RelStructure" minOccurs="0"/>')}
  ${ext('DataManagedObjectStructure', 'EntityInVersionStructure', '<xsd:group ref="DataManagedObjectGroup"/>')}
  ${group('DataManagedObjectGroup', '<xsd:element name="keyList" type="KeyListStructure" minOccurs="0"/>')}
  ${ext('GroupOfEntities_VersionStructure', 'DataManagedObjectStructure', '<xsd:group ref="GroupOfEntitiesGroup"/>')}
  ${group('GroupOfEntitiesGroup', '<xsd:element name="Name" type="MultilingualString"/>')}
  <xsd:element name="Site_" abstract="true"/>
  ${ext('Site_VersionStructure', 'GroupOfEntities_VersionStructure', '<xsd:group ref="SiteGroup"/>')}
  ${group('SiteGroup', '<xsd:element name="TopographicPlaceRef" type="TopographicPlaceRefStructure" minOccurs="0"/>')}
  ${ext('StopPlace_VersionStructure', 'Site_VersionStructure', '<xsd:group ref="StopPlaceGroup"/>')}
  ${group('StopPlaceGroup', '<xsd:element name="StopPlaceType" type="StopTypeEnumeration" minOccurs="0"/>')}`

const STOP_PLACE = `
  <xsd:element name="StopPlace">
    <xsd:complexType>
      <xsd:complexContent>
        <xsd:restriction base="StopPlace_VersionStructure">
          <xsd:sequence>
            <xsd:sequence><xsd:group ref="EntityInVersionGroup" minOccurs="0"/></xsd:sequence>
            <xsd:sequence><xsd:group ref="DataManagedObjectGroup"/></xsd:sequence>
            <xsd:sequence><xsd:group ref="GroupOfEntitiesGroup"/></xsd:sequence>
            <xsd:group ref="SiteGroup"/>
            <xsd:sequence><xsd:group ref="StopPlaceGroup"/></xsd:sequence>
          </xsd:sequence>
          <xsd:attribute name="id" type="StopPlaceIdType" use="required"/>
        </xsd:restriction>
      </xsd:complexContent>
    </xsd:complexType>
  </xsd:element>`

const names = (fields) => fields.map((f) => f.name)

describe('resolveElement', () => {
  it('ancestors from root, nothing filtered', () => {
    const { ancestors } = resolveElement('StopPlace', context(FRAMEWORK, STOP_PLACE))
    expect(ancestors.map((a) => a.name)).toEqual(['Entity', 'EntityInVersion', 'DataManagedObject', 'GroupOfEntities', 'Site'])
    expect(ancestors.find((a) => a.name === 'Entity').abstract).toBe(true)
    expect(ancestors.find((a) => a.name === 'Site').abstract).toBe(true)
    expect(ancestors.find((a) => a.name === 'DataManagedObject').abstract).toBe(false)
  })

  it('falls back to the named type and to <name>_VersionStructure', () => {
    const ctx = context(FRAMEWORK, '<xsd:element name="Other" type="Site_VersionStructure"/><xsd:element name="StopPlace"/>')
    expect(resolveElement('Other', ctx).ancestors.map((a) => a.name)).toEqual(['Entity', 'EntityInVersion', 'DataManagedObject', 'GroupOfEntities'])
    expect(resolveElement('StopPlace', ctx).ancestors.map((a) => a.name)).toEqual(['Entity', 'EntityInVersion', 'DataManagedObject', 'GroupOfEntities', 'Site'])
  })

  it('restriction override wins for attributes', () => {
    const { fields } = resolveElement('StopPlace', context(FRAMEWORK, STOP_PLACE))
    expect(fields[0]).toMatchObject({ name: 'id', required: true, type: 'StopPlaceIdType', isAttribute: true, origin: 'Entity' })
    expect(names(fields.slice(0, 2))).toEqual(['id', 'version'])
    expect(fields[1]).toMatchObject({ isAttribute: true, required: false, minOccurs: '0', maxOccurs: '1', origin: 'EntityInVersion' })
    expect(fields.filter((f) => f.name === 'id')).toHaveLength(1)
  })

  it('overridden attribute keeps its inherited position', () => {
    const ctx = context(
      `<xsd:complexType name="BaseStructure">
        <xsd:attribute name="nameOfClass" type="NameOfClass"/>
        <xsd:attribute name="id" type="ObjectIdType"/>
      </xsd:complexType>
      <xsd:element name="Thing">
        <xsd:complexType><xsd:complexContent>
          <xsd:restriction base="BaseStructure"><xsd:attribute name="id" type="ThingIdType" use="required"/></xsd:restriction>
        </xsd:complexContent></xsd:complexType>
      </xsd:element>`,
    )
    expect(resolveElement('Thing', ctx).fields.map((f) => [f.name, f.type, f.required])).toEqual([
      ['nameOfClass', 'NameOfClass', false],
      ['id', 'ThingIdType', true],
    ])
  })

  it('restriction omits unlisted groups', () => {
    const ctx = context(
      ext('BaseStructure', 'Nothing', '<xsd:group ref="AGroup"/><xsd:group ref="BGroup"/>'),
      group('AGroup', '<xsd:element name="A1"/>'),
      group('BGroup', '<xsd:element name="B1"/>'),
      `<xsd:element name="Thing">
        <xsd:complexType><xsd:complexContent>
          <xsd:restriction base="BaseStructure"><xsd:sequence><xsd:group ref="AGroup"/></xsd:sequence></xsd:restriction>
        </xsd:complexContent></xsd:complexType>
      </xsd:element>`,
    )
    expect(names(resolveElement('Thing', ctx).fields)).toEqual(['A1'])
  })

  it('origin is the type that introduced the group', () => {
    const { fields } = resolveElement('StopPlace', context(FRAMEWORK, STOP_PLACE))
    expect(fields.find((f) => f.name === 'Name').origin).toBe('GroupOfEntities')
    expect(fields.find((f) => f.name === 'StopPlaceType').origin).toBe('StopPlace')
  })

  it('order is root first', () => {
    const { fields } = resolveElement('StopPlace', context(FRAMEWORK, STOP_PLACE))
    expect(names(fields.filter((f) => !f.isAttribute))).toEqual([
      'validityConditions',
      'keyList',
      'Name',
      'TopographicPlaceRef',
      'StopPlaceType',
    ])
  })

  it('extension appends own particles after base fields, direct elements get the type origin', () => {
    const ctx = context(
      FRAMEWORK,
      ext('Quay_VersionStructure', 'Site_VersionStructure', '<xsd:element name="PublicCode" type="xsd:string" minOccurs="0"/>'),
      '<xsd:element name="Quay" type="Quay_VersionStructure"/>',
    )
    const { fields } = resolveElement('Quay', ctx)
    expect(names(fields.filter((f) => !f.isAttribute))).toEqual(['validityConditions', 'keyList', 'Name', 'TopographicPlaceRef', 'PublicCode'])
    expect(fields.find((f) => f.name === 'PublicCode')).toMatchObject({ origin: 'Quay', kind: 'string', isList: false })
    expect(fields.find((f) => f.name === 'id')).toMatchObject({ required: false, type: 'ObjectIdType' })
  })

  it('required respects group minOccurs', () => {
    const { fields } = resolveElement('StopPlace', context(FRAMEWORK, STOP_PLACE))
    // validityConditions is minOccurs 0 itself; Name is minOccurs 1 in a required group
    expect(fields.find((f) => f.name === 'Name').required).toBe(true)
    const ctx = context(
      ext('BaseStructure', 'Nothing', '<xsd:group ref="OptGroup" minOccurs="0"/>'),
      group('OptGroup', '<xsd:element name="Inner" minOccurs="1"/>'),
      '<xsd:element name="Thing" type="BaseStructure"/>',
    )
    expect(resolveElement('Thing', ctx).fields.find((f) => f.name === 'Inner')).toMatchObject({ minOccurs: '1', required: false })
  })

  it('choice members share id', () => {
    const ctx = context(
      ext(
        'Thing_VersionStructure',
        'Nothing',
        `<xsd:element name="Before"/>
         <xsd:choice minOccurs="0">
           <xsd:element name="OptA"/>
           <xsd:element name="OptB"/>
         </xsd:choice>
         <xsd:choice><xsd:element name="X"/><xsd:element name="Y"/></xsd:choice>`,
      ),
      '<xsd:element name="Thing"/>',
    )
    const { fields } = resolveElement('Thing', ctx)
    const by = (n) => fields.find((f) => f.name === n)
    expect(by('OptA').choice).toEqual({ id: 'Thing#1', minOccurs: '0', maxOccurs: '1' })
    expect(by('OptB').choice.id).toBe(by('OptA').choice.id)
    expect(by('OptA').required).toBe(false)
    expect(by('X').choice.id).toBe('Thing#2')
    expect(by('X').required).toBe(true)
    expect(by('Before').choice).toBeUndefined()
    expect(by('Before').required).toBe(true)
  })

  it('survives cyclic types and groups', () => {
    const ctx = context(
      ext('AStructure', 'BStructure', '<xsd:group ref="LoopGroup"/>'),
      ext('BStructure', 'AStructure'),
      group('LoopGroup', '<xsd:element name="L"/><xsd:group ref="LoopGroup"/>'),
      '<xsd:element name="A" type="AStructure"/>',
    )
    const { ancestors, fields } = resolveElement('A', ctx)
    expect(ancestors.map((a) => a.name)).toEqual(['B'])
    expect(names(fields)).toEqual(['L'])
  })
})
