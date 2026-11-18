import { displayName, moduleFromPath } from './naming.js'

/** @typedef {import('./xsd-parser.js').TypeDef} TypeDef */
/** @typedef {import('./xsd-parser.js').Particle} Particle */
/** @typedef {{ elements: Map<string, any>, types: Map<string, TypeDef>, groups: Map<string, {content: Particle[]}>, attributeGroups?: Map<string, {attributes: any[], attributeGroupRefs: string[]}>, enums: Map<string, any>, listTypes: Map<string, string>, simpleTypes?: Map<string, {base: string|null}> }} Context */
/** @typedef {{ id: string, minOccurs: string, maxOccurs: string }} Choice */
/** @typedef {{ name: string, type: string, kind: string, isAttribute: boolean, isList: boolean, minOccurs: string, maxOccurs: string, required: boolean, choice?: Choice, origin: string, description: string, refTarget?: string, contains?: {name: string, minOccurs: string, maxOccurs: string, ref: boolean, type?: string}[], structure?: string }} Field */
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
  const state = { ctx, origins: introducers(rootFirst, ctx), choiceCounters: new Map(), alternatives: new Map() }
  return {
    ancestors: ancestorsOf(name, chain, ctx),
    fields: mergeDuplicates([...attributeFields(rootFirst, ctx), ...particleFields(chain, 0, state)], state.alternatives),
  }
}

/**
 * One field per (origin, name, isAttribute), at its first position. The merged field is required only if every
 * occurrence is; occurrences in different alternatives of the same choice lose `choice` (present whichever is used).
 */
function mergeDuplicates(fields, alternatives) {
  const seen = new Map()
  const result = []
  for (const f of fields) {
    const key = `${f.origin}\u0000${f.name}\u0000${f.isAttribute}`
    const first = seen.get(key)
    if (!first) {
      seen.set(key, { field: f, alternatives: new Set([alternatives.get(f)]), choices: new Set([f.choice?.id]) })
      result.push(f)
      continue
    }
    first.field.required = first.field.required && f.required
    first.alternatives.add(alternatives.get(f))
    first.choices.add(f.choice?.id)
  }
  for (const { field, alternatives: alts, choices } of seen.values()) {
    if (field.choice && choices.size === 1 && alts.size > 1) delete field.choice
  }
  return result
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
        const missing = p.ref && !target // e.g. gml:Polygon or a Part 5 element: not in the parsed files
        const field = makeField(state.ctx, {
            name: p.name,
            type: missing ? p.name : (p.ref ? target.type ?? target.inlineType?.base : p.type) ?? '',
            unknown: missing,
            elementRef: p.ref ? p.name : undefined,
            isAttribute: false,
            minOccurs: p.minOccurs,
            maxOccurs: p.maxOccurs,
            required,
            choice: scope.choice,
            origin: (scope.typeLevel && state.origins.elements.get(p.name)) || scope.origin,
            description: p.description || target?.description || '',
          })
        if (scope.alternative) state.alternatives.set(field, scope.alternative)
        fields.push(field)
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
        p.content.forEach((alternative, i) => {
          fields.push(...expand([alternative], { ...scope, required, choice, alternative: `${choice.id}:${i}` }, state))
        })
        break
      }
    }
  }
  return fields
}

const INTEGER = ['integer', 'nonNegativeInteger', 'positiveInteger', 'negativeInteger', 'nonPositiveInteger', 'int', 'long', 'short', 'byte', 'unsignedInt', 'unsignedLong', 'unsignedShort', 'unsignedByte']
const SCALAR_KINDS = {
  'xsd:boolean': 'boolean',
  ...Object.fromEntries(INTEGER.map((t) => [`xsd:${t}`, 'integer'])),
  ...Object.fromEntries(['decimal', 'double', 'float'].map((t) => [`xsd:${t}`, 'decimal'])),
}

/**
 * Kind of a simple (text) type: built-in xsd types by name, named simpleTypes by following their restriction base.
 * A simpleType whose chain leaves the parsed files, or a union/list, is text ('string').
 * A type that is neither built-in nor a known simpleType is 'unknown'.
 */
function scalarKind(type, ctx) {
  const seen = new Set()
  let t = type
  while (t && !seen.has(t)) {
    if (t.startsWith('xsd:')) return SCALAR_KINDS[t] ?? 'string'
    const simple = ctx.simpleTypes?.get(t)
    if (!simple) break
    seen.add(t)
    t = simple.base
  }
  return seen.size > 0 ? 'string' : 'unknown'
}

/** Fields that are `<xsd:element ref="X">` to an abstract X (their refTarget is X). */
const headRefs = new WeakSet()

const isAbstractElement = (name, ctx) => !!ctx.elements.get(name)?.abstract
const isConcreteElement = (name, ctx) => ctx.elements.has(name) && !isAbstractElement(name, ctx)

/**
 * Determines kind (and the extra data each kind carries) for a field, by the priority rules.
 * `elementRef` is set when the field is `<xsd:element ref="X">`: refTarget is then X when X is an abstract head or
 * (except for kind 'ref', which points at what is referenced) a concrete element.
 */
function resolveKind(name, type, ctx, elementRef) {
  const { refTarget: referenced, ...base } = baseKind(name, type, ctx)
  const head = elementRef && isAbstractElement(elementRef, ctx) ? elementRef : undefined
  const concrete = elementRef && isConcreteElement(elementRef, ctx) ? elementRef : undefined
  const refTarget = head ?? (base.kind === 'ref' ? referenced ?? concrete : concrete)
  return { ...base, ...(refTarget ? { refTarget } : {}) }
}

const enumCache = new WeakMap()

/** ctx.enums plus every named union whose member types are all enums (values in member order, first occurrence wins). */
function enumsOf(ctx) {
  let enums = enumCache.get(ctx)
  if (enums) return enums
  enums = new Map(ctx.enums)
  for (const [name, simple] of ctx.simpleTypes ?? []) {
    const members = simple.memberTypes ?? []
    if (enums.has(name) || members.length === 0 || !members.every((m) => ctx.enums.has(m))) continue
    const values = new Map()
    for (const m of members) for (const v of ctx.enums.get(m).values) if (!values.has(v.value)) values.set(v.value, v)
    enums.set(name, { name, description: simple.description ?? '', values: [...values.values()] })
  }
  enumCache.set(ctx, enums)
  return enums
}

function baseKind(name, type, ctx) {
  const enums = enumsOf(ctx)
  if (enums.has(type)) return { kind: 'enum' }
  const itemType = ctx.listTypes.get(type)
  if (itemType && enums.has(itemType)) return { kind: 'enum', isList: true, type: itemType }
  if (/Refs?$/.test(name) || type.endsWith('RefStructure')) {
    const strip = (n) => n.replace(/(RefStructure|Refs|Ref)$/, '')
    const refTarget = [type, name].map(strip).find((n) => n && ctx.elements.has(n))
    return { kind: 'ref', ...(refTarget ? { refTarget } : {}) }
  }
  if (type.endsWith('_RelStructure') && ctx.types.has(type)) return { kind: 'list', contains: containsOf(type, ctx) }
  if (ctx.types.has(type)) return { kind: 'complex', structure: type }
  return { kind: scalarKind(type, ctx) }
}

/**
 * Element particles of a RelStructure type and its bases, direct, in choices or in groups; cardinality comes from the
 * enclosing choice. `ref` tells a global element (`ref="X"`) from a local declaration, which carries its own `type`.
 */
function containsOf(type, ctx) {
  const result = []
  const visit = (particles, inherited, path) => {
    for (const p of particles) {
      if (p.kind === 'element') {
        result.push({
          name: p.name,
          minOccurs: inherited?.minOccurs ?? p.minOccurs,
          maxOccurs: inherited?.maxOccurs ?? p.maxOccurs,
          ref: p.ref,
          ...(!p.ref && p.type ? { type: p.type } : {}),
        })
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
function makeField(ctx, { name, type, unknown = false, elementRef, isAttribute, minOccurs, maxOccurs, required, choice, origin, description }) {
  const { kind, isList = false, type: resolvedType = type, ...extra } = unknown ? { kind: 'unknown' } : resolveKind(name, type, ctx, elementRef)
  const field = {
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
  if (elementRef && isAbstractElement(elementRef, ctx)) headRefs.add(field)
  return field
}

/**
 * Resolves every concrete element, the enums, the flattened structure of each referenced complex type (also the
 * declared types of local elements in `contains`) and the concrete members of every referenced abstract element.
 */
export function resolveModel(ctx, partMap) {
  const structures = {}
  const heads = new Set()
  const addStructure = (type) => {
    if (type in structures) return
    structures[type] = [] // reserve first: guards against cycles
    structures[type] = resolveType(type, ctx)
    collect(structures[type])
  }
  const collect = (fields) => {
    for (const f of fields) {
      if (headRefs.has(f)) heads.add(f.refTarget)
      for (const c of f.contains ?? []) {
        if (c.ref && isAbstractElement(c.name, ctx)) heads.add(c.name)
        if (!c.ref && c.type && ctx.types.has(c.type)) addStructure(c.type)
      }
      if (f.kind === 'complex') addStructure(f.structure)
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
  elements.sort(byCodePoint)
  return { elements, enums: Object.fromEntries(enumsOf(ctx)), structures, substitutions: substitutionsFor(heads, ctx) }
}

const byCodePoint = (a, b) => {
  const x = typeof a === 'string' ? a : a.name
  const y = typeof b === 'string' ? b : b.name
  return x < y ? -1 : x > y ? 1 : 0
}

/** For each head: the concrete elements whose substitutionGroup chain reaches it, code-point sorted. */
function substitutionsFor(heads, ctx) {
  const members = new Map([...heads].map((h) => [h, []]))
  for (const [name, el] of ctx.elements) {
    if (el.abstract) continue
    const seen = new Set()
    let group = el.substitutionGroup
    while (group && !seen.has(group)) {
      seen.add(group)
      members.get(group)?.push(name)
      group = ctx.elements.get(group)?.substitutionGroup
    }
  }
  return Object.fromEntries([...members].map(([h, list]) => [h, list.sort(byCodePoint)]))
}

export { moduleFromPath }
