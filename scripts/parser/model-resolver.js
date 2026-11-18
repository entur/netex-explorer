import { displayName, moduleFromPath, humanizeModule } from './naming.js'

/** @typedef {import('./xsd-parser.js').TypeDef} TypeDef */
/** @typedef {import('./xsd-parser.js').Particle} Particle */
/** @typedef {{ elements: Map<string, any>, types: Map<string, TypeDef>, groups: Map<string, {content: Particle[]}>, attributeGroups?: Map<string, {attributes: any[], attributeGroupRefs: string[]}>, enums: Map<string, any>, listTypes: Map<string, string> }} Context */
/** @typedef {{ id: string, minOccurs: string, maxOccurs: string }} Choice */
/** @typedef {{ name: string, type: string, kind: string, isAttribute: boolean, isList: boolean, minOccurs: string, maxOccurs: string, required: boolean, choice?: Choice, origin: string, description: string, refTarget?: string, contains?: {name: string, minOccurs: string, maxOccurs: string}[], structure?: string }} Field */
/** @typedef {{ label: string, def: TypeDef }} ChainEntry  label = displayName of the type (element name for an inline type) */

/**
 * Resolves an element to its inheritance chain and all fields in XML order.
 * @param {string} name
 * @param {Context} ctx
 * @returns {{ ancestors: {name: string, abstract: boolean}[], fields: Field[] } | null}
 */
export function resolveElement(name, ctx) {
  const el = ctx.elements.get(name)
  if (!el) return null
  return resolveChain(name, typeChain(name, el, ctx), ctx)
}

/** Resolves a named complexType to its fields, with the type's display name as origin. */
export function resolveType(typeName, ctx) {
  return resolveChain(displayName(typeName), chainFromType(typeName, ctx), ctx).fields
}

function resolveChain(name, chain, ctx) {
  if (chain.length === 0) return { ancestors: [], fields: [] }
  const rootFirst = [...chain].reverse()
  const state = { ctx, origins: introducers(rootFirst, ctx), choiceCounters: new Map() }
  return {
    ancestors: ancestorsOf(name, chain, ctx),
    fields: [...attributeFields(rootFirst, ctx), ...particleFields(chain, 0, state)],
  }
}

/** The element's effective type followed by its bases, element first. Stops at unknown or repeated types. */
function typeChain(name, el, ctx) {
  /** @type {ChainEntry[]} */
  const chain = []
  let typeName = null
  if (el.inlineType) {
    chain.push({ label: name, def: el.inlineType })
    typeName = el.inlineType.base
  } else if (el.type) {
    typeName = el.type
  } else if (ctx.types.has(`${name}_VersionStructure`)) {
    typeName = `${name}_VersionStructure`
  }
  return followBases(chain, typeName, ctx)
}

function chainFromType(typeName, ctx) {
  return followBases([], typeName, ctx)
}

function followBases(chain, typeName, ctx) {
  const seen = new Set()
  while (typeName && ctx.types.has(typeName) && !seen.has(typeName)) {
    seen.add(typeName)
    const def = ctx.types.get(typeName)
    chain.push({ label: displayName(typeName), def })
    typeName = def.base
  }
  return chain
}

/** Every class above the element's own class, root first. */
function ancestorsOf(name, chain, ctx) {
  const ancestors = []
  for (const { label, def } of chain.slice(1).reverse()) {
    if (label === name) continue
    const abstract = def.abstract || [label, `${label}_`, `${label}_Dummy`].some((n) => ctx.elements.get(n)?.abstract)
    const last = ancestors[ancestors.length - 1]
    if (last?.name === label) last.abstract ||= abstract
    else ancestors.push({ name: label, abstract })
  }
  return ancestors
}

/** Which class first lists each group ref (also nested ones) and each element, walking the chain from the root. */
function introducers(rootFirst, ctx) {
  const groups = new Map()
  const elements = new Map()
  const visit = (particles, label, path) => {
    for (const p of particles) {
      if (p.kind === 'group') {
        if (!groups.has(p.ref)) groups.set(p.ref, label)
        const group = ctx.groups.get(p.ref)
        if (group && !path.has(p.ref)) visit(group.content, label, new Set(path).add(p.ref))
      } else if (p.kind === 'element') {
        if (!elements.has(p.name)) elements.set(p.name, label)
      } else visit(p.content, label, path)
    }
  }
  for (const { label, def } of rootFirst) visit(def.content, label, new Set())
  return { groups, elements }
}

/** A type's attributes: those from its attribute groups (recursively, cycle-guarded) first, then its own, which win by name. */
function attributesOf(def, ctx) {
  const fromGroups = []
  const walk = (refs, path) => {
    for (const ref of refs) {
      const group = ctx.attributeGroups?.get(ref)
      if (!group || path.has(ref)) continue
      const next = new Set(path).add(ref)
      fromGroups.push(...group.attributes)
      walk(group.attributeGroupRefs, next)
    }
  }
  walk(def.attributeGroupRefs ?? [], new Set())
  return [...fromGroups, ...def.attributes]
}

/** Attributes from the whole chain; a redefinition replaces the inherited one in place but keeps its origin. */
function attributeFields(rootFirst, ctx) {
  const byName = new Map()
  for (const { label, def } of rootFirst) {
    for (const attr of attributesOf(def, ctx)) {
      if (attr.use === 'prohibited') {
        byName.delete(attr.name)
        continue
      }
      const inherited = byName.get(attr.name)
      const required = attr.use === 'required'
      byName.set(
        attr.name,
        makeField(ctx, {
          name: attr.name,
          type: attr.type,
          isAttribute: true,
          minOccurs: required ? '1' : '0',
          maxOccurs: '1',
          required,
          origin: inherited?.origin ?? label,
          description: attr.description || inherited?.description || '',
        }),
      )
    }
  }
  return [...byName.values()]
}

/** extension = base fields + own particles; restriction (or no derivation) = own particles only. */
function particleFields(chain, index, state) {
  const { label, def } = chain[index]
  const inherited = def.derivation === 'extension' && chain[index + 1] ? particleFields(chain, index + 1, state) : []
  const scope = { origin: label, typeLevel: true, required: true, choice: undefined, groupPath: new Set() }
  return [...inherited, ...expand(def.content, scope, state)]
}

const atLeastOne = (minOccurs) => Number(minOccurs) >= 1

/** Flattens particles into fields, carrying origin, effective requiredness and the innermost choice. */
function expand(particles, scope, state) {
  const fields = []
  for (const p of particles) {
    const required = scope.required && atLeastOne(p.minOccurs)
    switch (p.kind) {
      case 'element': {
        const target = p.ref ? state.ctx.elements.get(p.name) : undefined
        fields.push(
          makeField(state.ctx, {
            name: p.name,
            type: p.type ?? target?.type ?? '',
            isAttribute: false,
            minOccurs: p.minOccurs,
            maxOccurs: p.maxOccurs,
            required,
            choice: scope.choice,
            origin: (scope.typeLevel && state.origins.elements.get(p.name)) || scope.origin,
            description: p.description || target?.description || '',
          }),
        )
        break
      }
      case 'group': {
        const group = state.ctx.groups.get(p.ref)
        if (!group || scope.groupPath.has(p.ref)) break
        const origin = (scope.typeLevel && state.origins.groups.get(p.ref)) || scope.origin
        const groupPath = new Set(scope.groupPath).add(p.ref)
        fields.push(...expand(group.content, { ...scope, origin, typeLevel: false, required, groupPath }, state))
        break
      }
      case 'sequence':
        fields.push(...expand(p.content, { ...scope, required }, state))
        break
      case 'choice': {
        const n = (state.choiceCounters.get(scope.origin) ?? 0) + 1
        state.choiceCounters.set(scope.origin, n)
        const choice = { id: `${scope.origin}#${n}`, minOccurs: p.minOccurs, maxOccurs: p.maxOccurs }
        fields.push(...expand(p.content, { ...scope, required, choice }, state))
        break
      }
    }
  }
  return fields
}

const SCALAR_KINDS = { 'xsd:boolean': 'boolean', 'xsd:integer': 'integer', 'xsd:decimal': 'decimal' }

/** Determines kind (and the extra data each kind carries) for a field, by the priority rules. */
function resolveKind(name, type, ctx) {
  if (ctx.enums.has(type)) return { kind: 'enum' }
  const itemType = ctx.listTypes.get(type)
  if (itemType && ctx.enums.has(itemType)) return { kind: 'enum', isList: true, type: itemType }
  if (/Refs?$/.test(name) || type.endsWith('RefStructure')) {
    const strip = (n) => n.replace(/(RefStructure|Refs|Ref)$/, '')
    const refTarget = [type, name].map(strip).find((n) => n && ctx.elements.has(n))
    return { kind: 'ref', ...(refTarget ? { refTarget } : {}) }
  }
  if (type.endsWith('_RelStructure')) return { kind: 'list', contains: containsOf(type, ctx) }
  if (ctx.types.has(type)) return { kind: 'complex', structure: type }
  return { kind: SCALAR_KINDS[type] ?? 'string' }
}

/** Element particles of a RelStructure type and its bases, direct, in choices or in groups; cardinality comes from the enclosing choice. */
function containsOf(type, ctx) {
  const result = []
  const visit = (particles, inherited, path) => {
    for (const p of particles) {
      if (p.kind === 'element') {
        result.push({ name: p.name, minOccurs: inherited?.minOccurs ?? p.minOccurs, maxOccurs: inherited?.maxOccurs ?? p.maxOccurs })
      } else if (p.kind === 'choice') visit(p.content, { minOccurs: p.minOccurs, maxOccurs: p.maxOccurs }, path)
      else if (p.kind === 'sequence') visit(p.content, inherited, path)
      else if (p.kind === 'group') {
        const group = ctx.groups.get(p.ref)
        if (group && !path.has(p.ref)) visit(group.content, inherited, new Set(path).add(p.ref))
      }
    }
  }
  for (const { def } of followBases([], type, ctx).reverse()) visit(def.content, null, new Set())
  return result
}

/** The single place a Field is built. */
function makeField(ctx, { name, type, isAttribute, minOccurs, maxOccurs, required, choice, origin, description }) {
  const { kind, isList = false, type: resolvedType = type, ...extra } = resolveKind(name, type, ctx)
  return {
    name,
    type: resolvedType,
    kind,
    isAttribute,
    isList,
    minOccurs,
    maxOccurs,
    required,
    ...(choice ? { choice } : {}),
    ...extra,
    origin,
    description,
  }
}

/** Resolves every concrete element, the enums and the flattened structure of each referenced complex type. */
export function resolveModel(ctx, partMap) {
  const structures = {}
  const collect = (fields) => {
    for (const f of fields) {
      if (f.kind !== 'complex' || f.structure in structures) continue
      structures[f.structure] = [] // reserve first: guards against cycles
      structures[f.structure] = resolveType(f.structure, ctx)
      collect(structures[f.structure])
    }
  }

  const elements = []
  for (const [name, el] of ctx.elements) {
    if (el.abstract) continue
    const { ancestors, fields } = resolveElement(name, ctx)
    collect(fields)
    elements.push({
      name,
      abstract: false,
      part: partMap.get(name) ?? 0,
      module: moduleFromPath(el.source ?? ''),
      description: el.description,
      ancestors,
      fields,
    })
  }
  elements.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  return { elements, enums: Object.fromEntries(ctx.enums), structures }
}

export { moduleFromPath, humanizeModule }
