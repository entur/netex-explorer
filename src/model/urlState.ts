export type Tab = 'felter' | 'struktur' | 'xml'

export interface UrlState {
  v: string
  element?: string
  enum?: string
  tab: Tab
}

export const DEFAULT_VERSION = 'v2.0'
const TABS: Tab[] = ['felter', 'struktur', 'xml']

export function readUrlState(search: string): UrlState {
  const p = new URLSearchParams(search)
  const tab = p.get('tab')
  return {
    v: p.get('v') || DEFAULT_VERSION,
    element: p.get('element') || undefined,
    enum: p.get('enum') || undefined,
    tab: TABS.includes(tab as Tab) ? (tab as Tab) : 'felter',
  }
}

/** Utelater standardverdier. Returnerer '' eller en streng som starter med '?'. */
export function toSearch(state: UrlState): string {
  const p = new URLSearchParams()
  if (state.v !== DEFAULT_VERSION) p.set('v', state.v)
  if (state.element) p.set('element', state.element)
  if (state.enum) p.set('enum', state.enum)
  if (state.tab !== 'felter') p.set('tab', state.tab)
  const s = p.toString()
  return s ? `?${s}` : ''
}
