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
    if (result.fields.length < MAX) {
      for (const field of element.fields) {
        // Bare felter definert på selve elementet, ikke arvede kopier
        if (field.origin !== element.name) continue
        if (field.name.toLowerCase().includes(needle)) {
          result.fields.push({ element, field })
          if (result.fields.length >= MAX) break
        }
      }
    }
  }
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
