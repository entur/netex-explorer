import type { Element, Field } from '../types'

export type FieldFilter = 'alle' | 'egne' | 'arvet' | 'pakrevd' | 'enums'

export function filterFields(el: Element, f: FieldFilter): Field[] {
  switch (f) {
    case 'egne':
      return el.fields.filter((x) => x.origin === el.name)
    case 'arvet':
      return el.fields.filter((x) => x.origin !== el.name)
    case 'pakrevd':
      return el.fields.filter((x) => x.required)
    case 'enums':
      return el.fields.filter((x) => x.kind === 'enum')
    default:
      return el.fields
  }
}

export function countFields(el: Element): Record<FieldFilter, number> {
  return {
    alle: filterFields(el, 'alle').length,
    egne: filterFields(el, 'egne').length,
    arvet: filterFields(el, 'arvet').length,
    pakrevd: filterFields(el, 'pakrevd').length,
    enums: filterFields(el, 'enums').length,
  }
}
