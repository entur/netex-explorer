import type { Element, EnumType, Field, VersionData } from '../types'

const MAX = 50

export interface SearchResult {
  elements: Element[]
  fields: { element: Element; field: Field }[]
  enums: EnumType[]
}

export function search(data: VersionData, q: string): SearchResult {
  const needle = q.trim().toLowerCase()
  const result: SearchResult = { elements: [], fields: [], enums: [] }
  if (!needle) return result

  for (const element of data.elements) {
    if (result.elements.length < MAX && element.name.toLowerCase().includes(needle)) {
      result.elements.push(element)
    }
  }
  result.fields = matchFields(data.elements, needle).slice(0, MAX)
  for (const e of Object.values(data.enums)) {
    if (result.enums.length >= MAX) break
    if (
      e.name.toLowerCase().includes(needle) ||
      e.values.some((v) => v.value.toLowerCase().includes(needle))
    ) {
      result.enums.push(e)
    }
  }
  return result
}

const byCodePoint = (a: Element, b: Element) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)

/** Ett treff per (feltnavn, origin). Lenker til elementet som heter origin hvis det finnes, ellers første element med feltet. */
function matchFields(elements: Element[], needle: string): { element: Element; field: Field }[] {
  const hits = new Map<string, { element: Element; field: Field }>()
  for (const element of [...elements].sort(byCodePoint)) {
    for (const field of element.fields) {
      if (!field.name.toLowerCase().includes(needle)) continue
      const key = `${field.isAttribute ? '@' : ''}${field.name}\u0000${field.origin}`
      const existing = hits.get(key)
      if (!existing || (element.name === field.origin && existing.element.name !== field.origin)) {
        hits.set(key, { element, field })
      }
    }
  }
  return [...hits.values()]
}
