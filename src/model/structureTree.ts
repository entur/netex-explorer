import type { Element, Field, VersionData } from '../types'

export type TreeNode =
  | { kind: 'divider'; origin: string }
  | { kind: 'field'; id: string; field: Field; expandable: boolean }
  | { kind: 'choice'; id: string; minOccurs: string; maxOccurs: string; children: TreeNode[] }
  | { kind: 'element'; id: string; name: string; minOccurs: string; maxOccurs: string; expandable: boolean; cycle: boolean }

function fieldExpandable(f: Field, data?: VersionData): boolean {
  if (f.kind === 'list') return !!f.contains?.length
  if (f.kind === 'complex') {
    if (!f.structure) return false
    return data ? !!data.structures[f.structure] : true
  }
  return false
}

function fieldNode(f: Field, prefix: string, data?: VersionData): TreeNode {
  return {
    kind: 'field',
    id: `${prefix}${f.isAttribute ? '@' : ''}${f.name}~${f.origin}`,
    field: f,
    expandable: fieldExpandable(f, data),
  }
}

/** Felter i rekkefølge; divider når origin skifter; felter med samme choice.id samles i én choice-node. */
export function fieldNodes(fields: Field[], data?: VersionData, prefix = ''): TreeNode[] {
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
      choice.children.push(fieldNode(f, `${choice.id}/`, data))
    } else {
      push(f.origin, fieldNode(f, prefix, data))
    }
  }
  return nodes
}

export function rootNodes(el: Element, data?: VersionData, prefix = ''): TreeNode[] {
  return fieldNodes(el.fields, data, prefix)
}

/**
 * path = elementnavn fra roten til noden (inkludert noden selv hvis den er et element).
 * Et element som allerede finnes i path får cycle:true og expandable:false.
 */
export function childNodes(node: TreeNode, data: VersionData, path: string[]): TreeNode[] {
  if (node.kind === 'divider') return []
  if (node.kind === 'choice') return node.children
  if (node.kind === 'element') {
    const el = data.elements.find((e) => e.name === node.name)
    return !node.expandable || !el ? [] : rootNodes(el, data, `${node.id}/`)
  }
  const f = node.field
  const prefix = `${node.id}/`
  if (f.kind === 'list' && f.contains) {
    return f.contains.map((c): TreeNode => {
      const exists = data.elements.some((e) => e.name === c.name)
      const cycle = path.includes(c.name)
      return {
        kind: 'element',
        id: `${prefix}${c.name}`,
        name: c.name,
        minOccurs: c.minOccurs,
        maxOccurs: c.maxOccurs,
        expandable: exists && !cycle,
        cycle,
      }
    })
  }
  if (f.kind === 'complex' && f.structure) {
    const structure = data.structures[f.structure]
    return structure ? fieldNodes(structure, data, prefix) : []
  }
  return []
}
