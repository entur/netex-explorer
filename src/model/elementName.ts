import type { Field, VersionData } from '../types'

const DUMMY_SUFFIX = '_Dummy'

/** Visningsnavn: `X_Dummy` (abstrakt substitusjonsgruppe-hode i XSD-en) vises som `X`. Bare visning, aldri lenkemål. */
export function displayName(name: string): string {
  return name.endsWith(DUMMY_SUFFIX) && name.length > DUMMY_SUFFIX.length ? name.slice(0, -DUMMY_SUFFIX.length) : name
}

export interface ElementLink {
  /** Navn som vises */
  label: string
  /** Elementet selv hvis det finnes i data.elements, ellers null (navnet gjettes aldri om) */
  target: string | null
  /** Konkrete elementer som kan stå i stedet når navnet er et abstrakt hode, ellers null */
  members: string[] | null
}

export function elementLink(name: string, data: Pick<VersionData, 'elements' | 'substitutions'>): ElementLink {
  return {
    label: displayName(name),
    target: data.elements.some((e) => e.name === name) ? name : null,
    members: data.substitutions[name] ?? null,
  }
}

/** Feltnavn slik det vises: «@» foran XML-attributter, uten _Dummy-suffiks */
export function fieldLabel(f: Pick<Field, 'name' | 'isAttribute'>): string {
  return f.isAttribute ? `@${f.name}` : displayName(f.name)
}
