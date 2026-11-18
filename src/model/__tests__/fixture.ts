import type { Element, Field, VersionData } from '../../types'

function field(partial: Partial<Field> & Pick<Field, 'name' | 'origin'>): Field {
  return {
    type: 'string',
    kind: 'string',
    isAttribute: false,
    isList: false,
    minOccurs: '0',
    maxOccurs: '1',
    required: false,
    description: '',
    ...partial,
  }
}

const stopPlace: Element = {
  name: 'StopPlace',
  abstract: false,
  part: 1,
  module: 'stopPlace',
  description: 'A named place where public transport may be accessed.',
  ancestors: [
    { name: 'Entity', abstract: true },
    { name: 'Site', abstract: true },
    { name: 'Zone', abstract: false },
  ],
  fields: [
    field({ name: 'id', origin: 'Entity', isAttribute: true, required: true, minOccurs: '1', type: 'StopPlaceIdType', description: 'Identifier of STOP PLACE.' }),
    field({ name: 'version', origin: 'Entity', isAttribute: true, description: 'Version of the entity.' }),
    field({ name: 'StopPlaceType', origin: 'StopPlace', type: 'StopTypeEnumeration', kind: 'enum', description: 'Type of stop place.' }),
    field({ name: 'quays', origin: 'StopPlace', type: 'quays_RelStructure', kind: 'list', contains: [
      { name: 'QuayRef', minOccurs: '1', maxOccurs: 'unbounded' },
      { name: 'Quay', minOccurs: '1', maxOccurs: 'unbounded' },
    ], description: 'Quays of the stop place.' }),
    field({ name: 'Name', origin: 'Zone', choice: { id: 'Zone#1', minOccurs: '0', maxOccurs: '1' } }),
    field({ name: 'ShortName', origin: 'Zone', choice: { id: 'Zone#1', minOccurs: '0', maxOccurs: '1' } }),
    field({ name: 'Mystery', origin: 'StopPlace', type: 'MissingEnumeration', kind: 'enum' }),
    field({ name: 'keyList', origin: 'Entity', type: 'KeyListStructure', kind: 'complex', structure: 'KeyListStructure' }),
    field({ name: 'SiteRef', origin: 'Site', type: 'SiteRef', kind: 'ref', refTarget: 'Site' }),
  ],
}

const quay: Element = {
  name: 'Quay',
  abstract: false,
  part: 1,
  module: 'stopPlace',
  description: 'A specific place for boarding.',
  ancestors: [{ name: 'Entity', abstract: true }],
  fields: [
    field({ name: 'id', origin: 'Entity', isAttribute: true, required: true, minOccurs: '1' }),
    field({ name: 'quays', origin: 'Quay', type: 'quays_RelStructure', kind: 'list', contains: [
      { name: 'Quay', minOccurs: '1', maxOccurs: 'unbounded' },
    ] }),
  ],
}

const line: Element = {
  name: 'Line',
  abstract: false,
  part: 1,
  module: 'line',
  description: 'A group of routes.',
  ancestors: [{ name: 'Entity', abstract: true }],
  fields: [field({ name: 'id', origin: 'Entity', isAttribute: true, required: true, minOccurs: '1' })],
}

const entity: Element = {
  name: 'Entity',
  abstract: true,
  part: 0,
  module: 'framework',
  description: 'Base entity.',
  ancestors: [],
  fields: [],
}

const fareProduct: Element = {
  name: 'FareProduct',
  abstract: false,
  part: 3,
  module: 'fareProduct',
  description: 'A fare product.',
  ancestors: [{ name: 'Entity', abstract: true }],
  fields: [field({ name: 'id', origin: 'Entity', isAttribute: true, required: true, minOccurs: '1' })],
}

export const fixture: VersionData = {
  version: 'v2.0',
  fetchedAt: '2026-01-01T00:00:00.000Z',
  elements: [stopPlace, quay, line, entity, fareProduct],
  enums: {
    StopTypeEnumeration: {
      name: 'StopTypeEnumeration',
      description: 'Allowed values for stop place type.',
      values: [
        { value: 'railStation', description: 'A railway station.' },
        { value: 'busStation', description: '' },
      ],
    },
  },
  structures: {
    KeyListStructure: [
      field({ name: 'KeyValue', origin: 'KeyList', type: 'KeyValueStructure', kind: 'complex', required: true, minOccurs: '1', maxOccurs: 'unbounded' }),
    ],
  },
  examples: [{ filename: 'example.xml', label: 'Eksempel', xml: '<PublicationDelivery/>' }],
}
