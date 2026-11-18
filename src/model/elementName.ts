import type { VersionData } from '../types'

const DUMMY_SUFFIX = '_Dummy'

export interface ElementDisplay {
  /** Navn som vises (uten _Dummy-suffikset) */
  label: string
  /** Abstrakt substitusjonsgruppe-hode (navn endte på _Dummy) */
  abstract: boolean
  /** Elementnavnet det kan lenkes til, eller null hvis det ikke finnes i data.elements */
  target: string | null
}

/** Visningsnavn og lenkemål for et elementnavn; håndterer `X_Dummy` på ett sted. */
export function elementDisplay(name: string, data: Pick<VersionData, 'elements'>): ElementDisplay {
  const abstract = name.endsWith(DUMMY_SUFFIX) && name.length > DUMMY_SUFFIX.length
  const label = abstract ? name.slice(0, -DUMMY_SUFFIX.length) : name
  const target = data.elements.some((e) => e.name === label) ? label : null
  return { label, abstract, target }
}
