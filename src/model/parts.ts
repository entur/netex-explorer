export interface PartName {
  /** Kort navn (knapper, merker) */
  label: string
  /** Fullt navn, inkludert delnummer */
  full: string
}

const PARTS: Record<number, PartName> = {
  0: { label: 'Rammeverk', full: 'NeTEx rammeverk (felles grunnstrukturer)' },
  1: { label: 'Nettverk', full: 'NeTEx del 1 – nettverk og stoppesteder' },
  2: { label: 'Rutedata', full: 'NeTEx del 2 – rutetider' },
  3: { label: 'Takstdata', full: 'NeTEx del 3 – takster og billettering' },
}

export function partName(part: number): PartName {
  return PARTS[part] ?? { label: `Del ${part}`, full: `Del ${part}` }
}
