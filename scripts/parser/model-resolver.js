import { displayName } from './naming.js'

/** @typedef {import('./xsd-parser.js').TypeDef} TypeDef */
/** @typedef {import('./xsd-parser.js').Particle} Particle */
/** @typedef {{ elements: Map<string, any>, types: Map<string, TypeDef>, groups: Map<string, {content: Particle[]}>, enums: Map<string, any>, listTypes: Map<string, string> }} Context */
/** @typedef {{ id: string, minOccurs: string, maxOccurs: string }} Choice */
/** @typedef {{ name: string, type: string, kind: string, isAttribute: boolean, isList: boolean, minOccurs: string, maxOccurs: string, required: boolean, choice?: Choice, origin: string, description: string }} Field */
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
  const chain = typeChain(name, el, ctx)
  if (chain.length === 0) return { ancestors: [], fields: [] }

  const rootFirst = [...chain].reverse()
  const state = { ctx, origins: introducers(rootFirst), choiceCounters: new Map() }
  return {
    ancestors: ancestorsOf(name, chain, ctx),
    fields: [...attributeFields(rootFirst), ...particleFields(chain, 0, state)],
  }
}

/** The element's effective type followed by its bases, element first. Stops at unknown or repeated types. */
function typeChain(name, el, ctx) {
  /** @type {ChainEntry[]} */
  const chain = []
  const seen = new Set()
  let typeName = null
  if (el.inlineType) {
    chain.push({ label: name, def: el.inlineType })
    typeName = el.inlineType.base
  } else {
    typeName = [el.type, `${name}_VersionStructure`].find((t) => t && ctx.types.has(t)) ?? null
  }
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

/** Which class first lists each group ref and each direct element, walking the chain from the root. */
function introducers(rootFirst) {
  const groups = new Map()
  const elements = new Map()
  const visit = (particles, label) => {
    for (const p of particles) {
      if (p.kind === 'group' && !groups.has(p.ref)) groups.set(p.ref, label)
      else if (p.kind === 'element' && !elements.has(p.name)) elements.set(p.name, label)
      else if (p.kind === 'sequence' || p.kind === 'choice') visit(p.content, label)
    }
  }
  for (const { label, def } of rootFirst) visit(def.content, label)
  return { groups, elements }
}

/** Attributes from the whole chain; a redefinition replaces the inherited one in place but keeps its origin. */
function attributeFields(rootFirst) {
  const byName = new Map()
  for (const { label, def } of rootFirst) {
    for (const attr of def.attributes) {
      const inherited = byName.get(attr.name)
      const required = attr.use === 'required'
      byName.set(
        attr.name,
        makeField({
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
          makeField({
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

/** The single place a Field is built. kind/isList are placeholders until type resolution is added. */
function makeField({ name, type, isAttribute, minOccurs, maxOccurs, required, choice, origin, description }) {
  return {
    name,
    type,
    kind: 'string',
    isAttribute,
    isList: false,
    minOccurs,
    maxOccurs,
    required,
    ...(choice ? { choice } : {}),
    origin,
    description,
  }
}
