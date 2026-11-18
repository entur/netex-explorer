import type { ContainedElement, Element, Field, VersionData } from '../types'
import { displayName, elementLink } from './elementName'

export type TreeNode =
  | { kind: 'divider'; origin: string }
  | { kind: 'field'; id: string; field: Field; expandable: boolean }
  | { kind: 'choice'; id: string; minOccurs: string; maxOccurs: string; children: TreeNode[] }
  | {
      kind: 'element'
      id: string
      name: string
      label: string
      /** true: globalt element (`ref`); false: lokal deklarasjon med egen `type` */
      ref: boolean
      type?: string
      /** Abstrakt hode: konkrete elementer som kan stå i stedet */
      members?: string[]
      abstract: boolean
      /** Mangler for medlemmer av et hode (antallet gjelder hodet) */
      minOccurs?: string
      maxOccurs?: string
      expandable: boolean
      cycle: boolean
    }

type ElementNode = Extract<TreeNode, { kind: 'element' }>

const isElement = (name: string, data?: VersionData) => !!data?.elements.some((e) => e.name === name)

/** Feltet peker på et abstrakt hode (`<xsd:element ref="X_Dummy">`) */
function fieldMembers(f: Field, data?: VersionData): string[] | null {
  return (f.refTarget && data?.substitutions[f.refTarget]) || null
}

/** Elementet et felt foldes ut til: `<xsd:element ref="X">` til et konkret element (ikke ref-felter, de peker videre). */
function fieldElement(f: Field, data?: VersionData): string | null {
  return f.kind !== 'ref' && f.refTarget && isElement(f.refTarget, data) ? f.refTarget : null
}

/** Elementnavnet en node åpner (for syklussjekk), eller null */
export function opensElement(node: TreeNode, data?: VersionData): string | null {
  if (node.kind === 'element') return node.ref && !node.members ? node.name : null
  if (node.kind === 'field') return node.field.kind !== 'ref' && node.field.refTarget && (!data || isElement(node.field.refTarget, data)) ? node.field.refTarget : null
  return null
}

function fieldExpandable(f: Field, path: string[], data?: VersionData): boolean {
  if (f.kind === 'list') return !!f.contains?.length
  const members = fieldMembers(f, data)
  if (members) return members.length > 0
  const element = fieldElement(f, data)
  if (element) return !path.includes(element)
  if (f.kind === 'complex') {
    if (!f.structure) return false
    return data ? !!data.structures[f.structure] : true
  }
  return false
}

function fieldNode(f: Field, prefix: string, path: string[], data?: VersionData): TreeNode {
  return {
    kind: 'field',
    id: `${prefix}${f.isAttribute ? '@' : ''}${f.name}~${f.origin}`,
    field: f,
    expandable: fieldExpandable(f, path, data),
  }
}

/** Felter i rekkefølge; divider når origin skifter; felter med samme choice.id samles i én choice-node. */
export function fieldNodes(fields: Field[], data?: VersionData, prefix = '', path: string[] = []): TreeNode[] {
  const nodes: TreeNode[] = []
  const choices = new Map<string, Extract<TreeNode, { kind: 'choice' }>>()
  let lastOrigin: string | null = null
  const push = (origin: string, node: TreeNode) => {
    if (origin !== lastOrigin) {
      nodes.push({ kind: 'divider', origin })
      lastOrigin = origin
    }
    nodes.push(node)
  }
  for (const f of fields) {
    if (f.choice) {
      let choice = choices.get(f.choice.id)
      if (!choice) {
        choice = {
          kind: 'choice',
          id: `${prefix}choice:${f.choice.id}`,
          minOccurs: f.choice.minOccurs,
          maxOccurs: f.choice.maxOccurs,
          children: [],
        }
        choices.set(f.choice.id, choice)
        push(f.origin, choice)
      }
      choice.children.push(fieldNode(f, `${choice.id}/`, path, data))
    } else {
      push(f.origin, fieldNode(f, prefix, path, data))
    }
  }
  return nodes
}

export function rootNodes(el: Element, data?: VersionData, prefix = '', path: string[] = [el.name]): TreeNode[] {
  return fieldNodes(el.fields, data, prefix, path)
}

/** Node for et globalt element: konkret (kan foldes ut, syklus), abstrakt hode (foldes ut til medlemmer) eller ukjent. */
function globalNode(name: string, id: string, data: VersionData, path: string[], occurs?: { minOccurs: string; maxOccurs: string }): ElementNode {
  const link = elementLink(name, data)
  if (link.members) {
    return { kind: 'element', id, name, label: link.label, ref: true, members: link.members, abstract: true, ...occurs, expandable: link.members.length > 0, cycle: false }
  }
  const cycle = link.target !== null && path.includes(name)
  return { kind: 'element', id, name, label: link.label, ref: true, abstract: false, ...occurs, expandable: link.target !== null && !cycle, cycle }
}

function containedNode(c: ContainedElement, prefix: string, data: VersionData, path: string[]): ElementNode {
  const occurs = { minOccurs: c.minOccurs, maxOccurs: c.maxOccurs }
  if (c.ref) return globalNode(c.name, `${prefix}${c.name}`, data, path, occurs)
  return {
    kind: 'element',
    id: `${prefix}${c.name}:${c.type ?? ''}`,
    name: c.name,
    label: displayName(c.name),
    ref: false,
    ...(c.type ? { type: c.type } : {}),
    abstract: false,
    ...occurs,
    expandable: !!(c.type && data.structures[c.type]),
    cycle: false,
  }
}

const membersOf = (members: string[], prefix: string, data: VersionData, path: string[]) =>
  members.map((m) => globalNode(m, `${prefix}${m}`, data, path))

/**
 * path = elementnavn fra roten til noden (inkludert elementet noden åpner, se opensElement).
 * Et element som allerede finnes i path får cycle:true og expandable:false.
 */
export function childNodes(node: TreeNode, data: VersionData, path: string[]): TreeNode[] {
  if (node.kind === 'divider') return []
  if (node.kind === 'choice') return node.children
  const prefix = `${node.id}/`
  if (node.kind === 'element') {
    if (!node.expandable) return []
    if (node.members) return membersOf(node.members, prefix, data, path)
    if (!node.ref) return node.type && data.structures[node.type] ? fieldNodes(data.structures[node.type], data, prefix, path) : []
    const el = data.elements.find((e) => e.name === node.name)
    return el ? rootNodes(el, data, prefix, path) : []
  }
  const f = node.field
  if (f.kind === 'list' && f.contains) return f.contains.map((c) => containedNode(c, prefix, data, path))
  const members = fieldMembers(f, data)
  if (members) return membersOf(members, prefix, data, path)
  const element = fieldElement(f, data)
  if (element) {
    const el = data.elements.find((e) => e.name === element)
    return el && node.expandable ? rootNodes(el, data, prefix, path) : []
  }
  if (f.kind === 'complex' && f.structure) {
    const structure = data.structures[f.structure]
    return structure ? fieldNodes(structure, data, prefix, path) : []
  }
  return []
}
