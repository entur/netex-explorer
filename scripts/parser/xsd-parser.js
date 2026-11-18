import { XMLParser } from 'fast-xml-parser'

/** @typedef {{kind:'element', name:string, ref:boolean, type:string|null, minOccurs:string, maxOccurs:string, description:string}
 *          | {kind:'group', ref:string, minOccurs:string, maxOccurs:string}
 *          | {kind:'sequence'|'choice', minOccurs:string, maxOccurs:string, content:Particle[]}} Particle */
/** @typedef {{name:string, type:string, use:'required'|'optional', description:string}} AttrDef */
/** @typedef {{base:string|null, derivation:'extension'|'restriction'|null, content:Particle[], attributes:AttrDef[], abstract:boolean, description:string}} TypeDef */

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
          inlineType: inline ? readComplexType(inline) : null,
          description: descriptionOf(node),
          source: sourcePath,
        })
        break
      }
      case 'complexType':
        types.set(name, readComplexType(node))
        break
      case 'group':
        groups.set(name, { content: readContent(childrenOf(node)) })
        break
      case 'simpleType':
        readSimpleType(node, name, enums, listTypes)
        break
    }
  }

  return { elements, types, groups, enums, listTypes }
}

/** @returns {TypeDef} */
function readComplexType(node) {
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
    content: readContent(body),
    attributes: body.filter((c) => tagOf(c) === 'attribute').map(readAttribute),
    abstract: attrsOf(node).abstract === 'true',
    description: descriptionOf(node),
  }
}

/** Reads particles; a plain top-level sequence (min/max 1) is flattened. */
function readContent(nodes) {
  const particles = readParticles(nodes)
  const [only] = particles
  if (particles.length === 1 && only.kind === 'sequence' && only.minOccurs === '1' && only.maxOccurs === '1') {
    return only.content
  }
  return particles
}

/** @returns {Particle[]} */
function readParticles(nodes) {
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
          type: a.type ?? null,
          ...occurs,
          description: descriptionOf(node),
        })
        break
      case 'group':
        if (a.ref) result.push({ kind: 'group', ref: a.ref, ...occurs })
        break
      case 'sequence':
      case 'choice':
        result.push({ kind: tagOf(node), ...occurs, content: readParticles(childrenOf(node)) })
        break
    }
  }
  return result
}

/** @returns {AttrDef} */
function readAttribute(node) {
  const a = attrsOf(node)
  return {
    name: a.name ?? a.ref ?? '',
    type: a.type ?? '',
    use: a.use === 'required' ? 'required' : 'optional',
    description: descriptionOf(node),
  }
}

function readSimpleType(node, name, enums, listTypes) {
  const kids = childrenOf(node)
  const list = kids.find((c) => tagOf(c) === 'list')
  if (list) {
    const itemType = attrsOf(list).itemType
    if (itemType) listTypes.set(name, itemType)
    return
  }
  const restriction = kids.find((c) => tagOf(c) === 'restriction')
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
