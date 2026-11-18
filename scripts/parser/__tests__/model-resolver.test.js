import { describe, it, expect } from 'vitest'
import { parseXsd } from '../xsd-parser.js'
import { resolveElement, resolveModel, moduleFromPath, humanizeModule } from '../model-resolver.js'

const wrap = (body) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">${body}</xsd:schema>`

/** Parses each XSD body and merges the maps into one context, like the pipeline does. */
function context(...bodies) {
  const ctx = { elements: new Map(), types: new Map(), groups: new Map(), enums: new Map(), listTypes: new Map(), attributeGroups: new Map() }
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
  it('resolves attribute groups with the referencing class as origin', () => {
    const ctx = context(
      '<xsd:attributeGroup name="BasicModificationDetailsGroup"><xsd:attribute name="version" type="xsd:string"/></xsd:attributeGroup>',
      '<xsd:complexType name="EntityInVersionStructure"><xsd:attributeGroup ref="BasicModificationDetailsGroup"/></xsd:complexType>',
      ext('ThingStructure', 'EntityInVersionStructure'),
      '<xsd:element name="Thing" type="ThingStructure"/>',
    )
    const { fields } = resolveElement('Thing', ctx)
    expect(fields.find((f) => f.name === 'version')).toMatchObject({ isAttribute: true, origin: 'EntityInVersion' })
  })

  it('expands nested attribute groups and survives group cycles', () => {
    const ctx = context(
      '<xsd:attributeGroup name="A"><xsd:attribute name="a" type="xsd:string"/><xsd:attributeGroup ref="B"/></xsd:attributeGroup>',
      '<xsd:attributeGroup name="B"><xsd:attribute name="b" type="xsd:string"/><xsd:attributeGroup ref="A"/></xsd:attributeGroup>',
      '<xsd:complexType name="TStructure"><xsd:attributeGroup ref="A"/></xsd:complexType>',
      '<xsd:element name="T" type="TStructure"/>',
    )
    expect(names(resolveElement('T', ctx).fields)).toEqual(['a', 'b'])
  })

  it('removes attributes that a type prohibits', () => {
    const ctx = context(
      '<xsd:complexType name="BStructure"><xsd:attribute name="id" type="xsd:string"/><xsd:attribute name="keep" type="xsd:string"/></xsd:complexType>',
      ext('CStructure', 'BStructure', '', '<xsd:attribute name="id" use="prohibited"/>'),
      '<xsd:element name="C" type="CStructure"/>',
    )
    expect(names(resolveElement('C', ctx).fields)).toEqual(['keep'])
  })

  it('does not substitute another type when el.type is set but unknown', () => {
    const ctx = context(
      '<xsd:complexType name="Ghost_VersionStructure"><xsd:sequence><xsd:element name="X"/></xsd:sequence></xsd:complexType>',
      '<xsd:element name="Ghost" type="MissingStructure"/>',
      '<xsd:element name="Typeless"/>',
    )
    expect(resolveElement('Ghost', ctx).fields).toEqual([])
    expect(resolveElement('Typeless', ctx).fields).toEqual([])
  })

  it('falls back to Name_VersionStructure only when the element has no type', () => {
    const ctx = context(
      '<xsd:complexType name="Ghost_VersionStructure"><xsd:sequence><xsd:element name="X"/></xsd:sequence></xsd:complexType>',
      '<xsd:element name="Ghost"/>',
    )
    expect(names(resolveElement('Ghost', ctx).fields)).toEqual(['X'])
  })

  it('gives a sub-group listed directly in a restriction the ancestor class as origin', () => {
    const ctx = context(
      group('OuterGroup', '<xsd:group ref="InnerGroup"/>'),
      group('InnerGroup', '<xsd:element name="Deep"/>'),
      ext('BaseStructure', 'RootStructure', '<xsd:group ref="OuterGroup"/>'),
      '<xsd:complexType name="RootStructure"/>',
      `<xsd:element name="Leaf"><xsd:complexType><xsd:complexContent>
         <xsd:restriction base="BaseStructure"><xsd:sequence><xsd:group ref="InnerGroup"/></xsd:sequence></xsd:restriction>
       </xsd:complexContent></xsd:complexType></xsd:element>`,
    )
    expect(resolveElement('Leaf', ctx).fields.find((f) => f.name === 'Deep').origin).toBe('Base')
  })
})

describe('field kinds', () => {
  const one = (extra, inner) => {
    const ctx = context(
      extra,
      `<xsd:complexType name="HolderStructure"><xsd:sequence>${inner}</xsd:sequence></xsd:complexType>`,
      '<xsd:element name="Holder" type="HolderStructure"/>',
    )
    return { ctx, fields: resolveElement('Holder', ctx).fields }
  }
  const ENUM = `<xsd:simpleType name="ColorEnumeration"><xsd:restriction base="xsd:string"><xsd:enumeration value="red"/></xsd:restriction></xsd:simpleType>`

  it('enum kind', () => {
    const { fields } = one(ENUM, '<xsd:element name="Color" type="ColorEnumeration"/>')
    expect(fields[0]).toMatchObject({ kind: 'enum', type: 'ColorEnumeration', isList: false })
  })

  it('list of enum sets isList and itemType', () => {
    const { fields } = one(
      ENUM + '<xsd:simpleType name="ColorListOfEnumerations"><xsd:list itemType="ColorEnumeration"/></xsd:simpleType>',
      '<xsd:element name="Colors" type="ColorListOfEnumerations"/>',
    )
    expect(fields[0]).toMatchObject({ kind: 'enum', isList: true, type: 'ColorEnumeration' })
  })

  it('RelStructure contains expands groups and the base type chain', () => {
    const ctx = context(
      `<xsd:complexType name="base_RelStructure"><xsd:sequence><xsd:element ref="Base"/></xsd:sequence></xsd:complexType>
       ${group('ItemsGroup', '<xsd:choice maxOccurs="unbounded"><xsd:element ref="Quay"/></xsd:choice>')}
       <xsd:complexType name="quays_RelStructure"><xsd:complexContent><xsd:extension base="base_RelStructure">
         <xsd:sequence><xsd:group ref="ItemsGroup"/></xsd:sequence>
       </xsd:extension></xsd:complexContent></xsd:complexType>
       <xsd:element name="Quay" type="xsd:string"/>`,
    )
    const el = context(
      '<xsd:element name="Holder"><xsd:complexType><xsd:sequence><xsd:element name="quays" type="quays_RelStructure"/></xsd:sequence></xsd:complexType></xsd:element>',
    )
    for (const key of Object.keys(ctx)) for (const [k, v] of ctx[key]) el[key].set(k, v)
    const f = resolveElement('Holder', el).fields[0]
    expect(f.kind).toBe('list')
    expect(f.contains.map((c) => c.name)).toEqual(['Base', 'Quay'])
    expect(f.contains[1].maxOccurs).toBe('unbounded')
  })
  it('RelStructure contains Quay and QuayRef', () => {
    const { fields } = one(
      `<xsd:complexType name="quays_RelStructure"><xsd:sequence>
         <xsd:choice maxOccurs="unbounded">
           <xsd:element ref="QuayRef"/>
           <xsd:element name="Quay" type="QuayStructure"/>
         </xsd:choice></xsd:sequence></xsd:complexType>
       <xsd:element name="Quay" type="QuayStructure"/>
       <xsd:element name="QuayRef" type="QuayRefStructure"/>`,
      '<xsd:element name="quays" type="quays_RelStructure"/>',
    )
    expect(fields[0].kind).toBe('list')
    expect(fields[0].contains.map((c) => c.name)).toEqual(['QuayRef', 'Quay'])
    expect(fields[0].contains.every((c) => c.maxOccurs === 'unbounded')).toBe(true)
  })

  it('ref kind sets refTarget only when the target element exists', () => {
    const { fields } = one(
      '<xsd:element name="Place"/>',
      '<xsd:element name="PlaceRef" type="PlaceRefStructure"/><xsd:element name="GhostRef" type="GhostRefStructure"/>',
    )
    expect(fields[0]).toMatchObject({ kind: 'ref', refTarget: 'Place' })
    expect(fields[1].kind).toBe('ref')
    expect(fields[1].refTarget).toBeUndefined()
  })

  it('complex type fills structures', () => {
    const { ctx, fields } = one(
      '<xsd:complexType name="KeyListStructure"><xsd:sequence><xsd:element name="KeyValue" type="KeyValueStructure"/></xsd:sequence></xsd:complexType>' +
        '<xsd:complexType name="KeyValueStructure"><xsd:sequence><xsd:element name="Key" type="xsd:string"/></xsd:sequence></xsd:complexType>',
      '<xsd:element name="keyList" type="KeyListStructure"/><xsd:element name="n" type="xsd:integer"/><xsd:element name="f" type="xsd:boolean"/><xsd:element name="s" type="xsd:token"/>',
    )
    expect(fields.map((f) => f.kind)).toEqual(['complex', 'integer', 'boolean', 'string'])
    expect(fields[0].structure).toBe('KeyListStructure')
    const { structures } = resolveModel(ctx, new Map())
    expect(structures.KeyListStructure.map((f) => f.name)).toEqual(['KeyValue'])
    expect(structures.KeyListStructure[0].origin).toBe('KeyList')
    expect(structures.KeyValueStructure.map((f) => f.name)).toEqual(['Key'])
  })
})

describe('resolveModel', () => {
  it('excludes abstract elements and adds part, module and sorting', () => {
    const ctx = context(
      '<xsd:element name="Zed" type="ZStructure"/><xsd:element name="Alpha" type="ZStructure"/><xsd:element name="Hidden" abstract="true" type="ZStructure"/>',
      '<xsd:complexType name="ZStructure"><xsd:sequence><xsd:element name="x"/></xsd:sequence></xsd:complexType>',
    )
    ctx.elements.get('Alpha').source = 'xsd/netex_part_1/part1_ifopt/netex_ifopt_stopPlace_version.xsd'
    const { elements } = resolveModel(ctx, new Map([['Alpha', 2]]))
    expect(elements.map((e) => e.name)).toEqual(['Alpha', 'Zed'])
    expect(elements[0]).toMatchObject({ abstract: false, part: 2, module: 'stopPlace' })
    expect(elements[0].fields.map((f) => f.name)).toEqual(['x'])
  })

  it('exposes enums by name', () => {
    const ctx = context(
      '<xsd:simpleType name="ColorEnumeration"><xsd:restriction base="xsd:string"><xsd:enumeration value="red"/></xsd:restriction></xsd:simpleType>',
    )
    expect(resolveModel(ctx, new Map()).enums.ColorEnumeration.values[0].value).toBe('red')
  })
})

describe('module helpers', () => {
  it('moduleFromPath', () => {
    expect(moduleFromPath('xsd/netex_part_1/part1_ifopt/netex_ifopt_stopPlace_version.xsd')).toBe('stopPlace')
    expect(moduleFromPath('xsd/netex_part_3/part3_fares/netex_fareProduct_version.xsd')).toBe('fareProduct')
  })
  it('humanizeModule', () => {
    expect(humanizeModule('stopPlace')).toBe('Stop place')
    expect(humanizeModule('fareProduct')).toBe('Fare product')
  })
})
