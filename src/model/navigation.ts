import type { Element } from '../types'

export type PartFilter = 'alle' | 0 | 1 | 2 | 3

/** 'stopPlace' → 'Stop place' (samme regel som scripts/parser/naming.js) */
export function humanizeModule(module: string): string {
  const words = module.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function groupByModule(
  elements: Element[],
  part: PartFilter,
): { module: string; label: string; elements: Element[] }[] {
  const groups = new Map<string, Element[]>()
  for (const el of elements) {
    if (part !== 'alle' && el.part !== part) continue
    const list = groups.get(el.module)
    if (list) list.push(el)
    else groups.set(el.module, [el])
  }
  return [...groups.entries()]
    .map(([module, els]) => ({
      module,
      label: humanizeModule(module),
      elements: els.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}
