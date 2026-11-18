import { XMLParser } from 'fast-xml-parser'

/** @typedef {{kind:'element', name:string, ref:boolean, type:string|null, minOccurs:string, maxOccurs:string, description:string}
 *          | {kind:'group', ref:string, minOccurs:string, maxOccurs:string}
 *          | {kind:'sequence'|'choice', minOccurs:string, maxOccurs:string, content:Particle[]}} Particle */
/** @typedef {{name:string, type:string, use:'required'|'optional'|'prohibited', description:string}} AttrDef */
/** @typedef {{base:string|null, derivation:'extension'|'restriction'|null, content:Particle[], attributes:AttrDef[], attributeGroupRefs:string[], abstract:boolean, description:string}} TypeDef */
/** @typedef {{base:string|null, memberTypes:string[], description:string}} SimpleTypeDef  base = restriction base (null for union and list); memberTypes of a union */

const TAG_PREFIX = 'xsd:'

/**
 * Parse one XSD file into maps, preserving document order of particles.
 * @param {string} xsdString
 * @param {string} [sourcePath]
 */
export function parseXsd(xsdString, sourcePath = '') {
  // parseAttributeValue: false keeps attribute values as strings (abstract === 'true')
  const parser = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: false,
    trimValues: true,
  })
  const doc = parser.parse(xsdString)
  const schema = doc.find((n) => tagOf(n) === 'schema')

  const elements = new Map()
  const types = new Map()
  const groups = new Map()
  const enums = new Map()
  const listTypes = new Map()
  const attributeGroups = new Map()
  const simpleTypes = new Map()
  // Anonymous types of local elements are registered in `types` under '<owner>/<element>'
  const reader = (owner) => ({ owner, types, listTypes, simpleTypes })

  for (const node of childrenOf(schema)) {
    const a = attrsOf(node)
    const name = a.name
    if (!name) continue
    switch (tagOf(node)) {
      case 'element': {
        const inline = childrenOf(node).find((c) => tagOf(c) === 'complexType')
        elements.set(name, {
          abstract: a.abstract === 'true',
          substitutionGroup: a.substitutionGroup ?? null,
          type: a.type ?? null,
          inlineType: inline ? readComplexType(inline, reader(name)) : null,
          description: descriptionOf(node),
          source: sourcePath,
        })
        break
      }
      case 'complexType':
        types.set(name, readComplexType(node, reader(name)))
        break
      case 'group':
        groups.set(name, { content: readContent(childrenOf(node), reader(name)) })
        break
      case 'attributeGroup': {
        const kids = childrenOf(node)
        attributeGroups.set(name, {
          attributes: kids.filter((c) => tagOf(c) === 'attribute').map((c) => readAttribute(c, reader(name))),
          attributeGroupRefs: attributeGroupRefsOf(kids),
        })
        break
      }
      case 'simpleType':
        readSimpleType(node, name, enums, listTypes, simpleTypes)
        break
    }
  }

  return { elements, types, groups, enums, listTypes, attributeGroups, simpleTypes }
}

/** @returns {TypeDef} */
function readComplexType(node, reader) {
  const kids = childrenOf(node)
  // complexContent / simpleContent wraps an extension or restriction
  const wrapper = kids.find((c) => ['complexContent', 'simpleContent'].includes(tagOf(c)))
  const derivation = wrapper
    ? childrenOf(wrapper).find((c) => ['extension', 'restriction'].includes(tagOf(c)))
    : undefined
  const body = derivation ? childrenOf(derivation) : kids
  return {
    base: derivation ? attrsOf(derivation).base ?? null : null,
    derivation: derivation ? tagOf(derivation) : null,
    content: readContent(body, reader),
    attributes: body.filter((c) => tagOf(c) === 'attribute').map((c) => readAttribute(c, reader)),
    attributeGroupRefs: attributeGroupRefsOf(body),
    abstract: attrsOf(node).abstract === 'true',
    description: descriptionOf(node),
  }
}

function attributeGroupRefsOf(nodes) {
  return nodes.filter((c) => tagOf(c) === 'attributeGroup' && attrsOf(c).ref).map((c) => attrsOf(c).ref)
}

/** Reads particles; a plain top-level sequence (min/max 1) is flattened. */
function readContent(nodes, reader) {
  const particles = readParticles(nodes, reader)
  const [only] = particles
  if (particles.length === 1 && only.kind === 'sequence' && only.minOccurs === '1' && only.maxOccurs === '1') {
    return only.content
  }
  return particles
}

/** @returns {Particle[]} */
function readParticles(nodes, reader) {
  const result = []
  for (const node of nodes) {
    const a = attrsOf(node)
    const occurs = { minOccurs: a.minOccurs ?? '1', maxOccurs: a.maxOccurs ?? '1' }
    switch (tagOf(node)) {
      case 'element':
        result.push({
          kind: 'element',
          name: a.name ?? a.ref ?? '',
          ref: a.ref !== undefined,
          type: a.type ?? (a.name ? inlineTypeName(node, a.name, reader) : null),
          ...occurs,
          description: descriptionOf(node),
        })
        break
      case 'group':
        if (a.ref) result.push({ kind: 'group', ref: a.ref, ...occurs })
        break
      case 'sequence':
      case 'choice':
        result.push({ kind: tagOf(node), ...occurs, content: readParticles(childrenOf(node), reader) })
        break
    }
  }
  return result
}

/**
 * Inline simpleType: a restriction → its base; a list or union → registered under `key` in listTypes/simpleTypes.
 */
function inlineSimpleTypeName(simple, key, reader) {
  const kids = childrenOf(simple)
  const restriction = kids.find((c) => tagOf(c) === 'restriction')
  if (restriction) return attrsOf(restriction).base ?? null
  if (!reader) return null
  const list = kids.find((c) => tagOf(c) === 'list')
  const union = kids.find((c) => tagOf(c) === 'union')
  if (list && attrsOf(list).itemType) reader.listTypes.set(key, attrsOf(list).itemType)
  const memberTypes = union ? (attrsOf(union).memberTypes ?? '').split(/\s+/).filter(Boolean) : []
  reader.simpleTypes.set(key, { base: null, memberTypes, description: '' })
  return key
}

/**
 * Type of a local element declared with an inline type:
 * - inline simpleType → see inlineSimpleTypeName;
 * - inline complexType that only extends a base → the base (same content model);
 * - any other inline complexType → registered in `types` as '<owner>/<element>' and named so.
 * Returns null when there is no inline type.
 */
function inlineTypeName(node, name, reader) {
  const kids = childrenOf(node)
  const simple = kids.find((c) => tagOf(c) === 'simpleType')
  if (simple) return inlineSimpleTypeName(simple, `${reader?.owner}/${name}`, reader)
  const complex = kids.find((c) => tagOf(c) === 'complexType')
  if (!complex || !reader) return null
  const def = readComplexType(complex, { ...reader, owner: `${reader.owner}/${name}` })
  const pureExtension =
    def.derivation === 'extension' && def.base && def.content.length === 0 && def.attributes.length === 0 && def.attributeGroupRefs.length === 0
  if (pureExtension) return def.base
  const key = `${reader.owner}/${name}`
  reader.types.set(key, def)
  return key
}

/** @returns {AttrDef} */
function readAttribute(node, reader) {
  const a = attrsOf(node)
  const simple = childrenOf(node).find((c) => tagOf(c) === 'simpleType')
  const inline = simple && a.name ? inlineSimpleTypeName(simple, `${reader?.owner}/@${a.name}`, reader) : null
  return {
    name: a.name ?? a.ref ?? '',
    // a named attribute without type is xsd:anySimpleType by the XSD default
    type: a.type ?? inline ?? (a.name ? 'xsd:anySimpleType' : ''),
    use: a.use === 'required' || a.use === 'prohibited' ? a.use : 'optional',
    description: descriptionOf(node),
  }
}

function readSimpleType(node, name, enums, listTypes, simpleTypes) {
  const kids = childrenOf(node)
  const list = kids.find((c) => tagOf(c) === 'list')
  const restriction = kids.find((c) => tagOf(c) === 'restriction')
  const union = kids.find((c) => tagOf(c) === 'union')
  simpleTypes.set(name, {
    base: restriction ? attrsOf(restriction).base ?? null : null,
    memberTypes: union ? (attrsOf(union).memberTypes ?? '').split(/\s+/).filter(Boolean) : [],
    description: descriptionOf(node),
  })
  if (list) {
    const itemType = attrsOf(list).itemType
    if (itemType) listTypes.set(name, itemType)
    return
  }
  if (!restriction || !name.endsWith('Enumeration')) return
  const values = childrenOf(restriction)
    .filter((c) => tagOf(c) === 'enumeration' && attrsOf(c).value)
    .map((c) => ({ value: attrsOf(c).value, description: descriptionOf(c) }))
  if (values.length > 0) enums.set(name, { name, description: descriptionOf(node), values })
}

function descriptionOf(node) {
  const annotation = childrenOf(node).find((c) => tagOf(c) === 'annotation')
  const doc = annotation && childrenOf(annotation).find((c) => tagOf(c) === 'documentation')
  if (!doc) return ''
  return childrenOf(doc)
    .map((c) => c['#text'])
    .filter((t) => t !== undefined)
    .join(' ')
    .trim()
}

function tagOf(node) {
  const key = Object.keys(node ?? {}).find((k) => k !== ':@' && k !== '#text')
  return key?.startsWith(TAG_PREFIX) ? key.slice(TAG_PREFIX.length) : key
}

function childrenOf(node) {
  const key = Object.keys(node ?? {}).find((k) => k !== ':@')
  const kids = key ? node[key] : []
  return Array.isArray(kids) ? kids : []
}

function attrsOf(node) {
  const raw = node?.[':@'] ?? {}
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.replace(/^@_/, ''), v]))
}
