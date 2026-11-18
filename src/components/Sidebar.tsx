import { useId, useMemo, useState } from 'react'
import { TextField, SegmentedControl, SegmentedChoice } from '@entur/form'
import { SideNavigation } from '@entur/menu/beta'
import type { VersionData } from '../types'
import { groupByModule, type PartFilter } from '../model/navigation'
import { partName } from '../model/parts'
import { search } from '../model/search'
import { toSearch, type UrlState } from '../model/urlState'
import './Sidebar.css'

export interface SidebarProps {
  data: VersionData | null
  state: UrlState
  onNavigate: (target: { element?: string; enum?: string }) => void
}

const PART_CHOICES: { value: string; label: string; title?: string }[] = [
  { value: 'alle', label: 'Alle' },
  ...[0, 1, 2, 3].map((p) => ({ value: String(p), label: partName(p).label, title: partName(p).full })),
]

function href(state: UrlState, target: { element?: string; enum?: string }) {
  return `${import.meta.env.BASE_URL}${toSearch({ v: state.v, tab: state.tab, ...target })}`
}

export function Sidebar({ data, state, onNavigate }: SidebarProps) {
  const [query, setQuery] = useState('')
  const [part, setPart] = useState<PartFilter>('alle')
  // På smale skjermer er elementlisten foldet sammen når et element/enum er valgt (CSS skjuler den bare under 50rem)
  const [listOpen, setListOpen] = useState(!state.element && !state.enum)
  const listId = useId()

  const groups = useMemo(() => (data ? groupByModule(data.elements, part) : []), [data, part])
  const results = useMemo(() => (data ? search(data, query) : null), [data, query])
  const hasResults =
    !!results && (results.elements.length > 0 || results.fields.length > 0 || results.enums.length > 0)
  const enums = useMemo(
    () => (data ? Object.values(data.enums).sort((a, b) => a.name.localeCompare(b.name)) : []),
    [data],
  )

  function item(label: string, target: { element?: string; enum?: string }, key: string) {
    const active = target.element ? state.element === target.element : state.enum === target.enum
    return (
      <SideNavigation.Item
        key={key}
        href={href(state, target)}
        active={active}
        onClick={(e: React.MouseEvent) => {
          e.preventDefault()
          setListOpen(false)
          onNavigate(target)
        }}
      >
        {label}
      </SideNavigation.Item>
    )
  }

  return (
    <nav className="sidebar" aria-label="Elementer">
      <TextField label="Søk" value={query} onChange={(e) => setQuery(e.target.value)} />
      <SegmentedControl
        label="Del"
        value={String(part)}
        onChange={(v) => setPart(v === 'alle' || v === null ? 'alle' : (Number(v) as PartFilter))}
      >
        {PART_CHOICES.map((c) => (
          <SegmentedChoice key={c.value} value={c.value} title={c.title} aria-label={c.title ? `${c.label} – ${c.title}` : undefined}>
            {c.label}
          </SegmentedChoice>
        ))}
      </SegmentedControl>

      <button
        type="button"
        className="sidebar__toggle"
        aria-expanded={listOpen}
        aria-controls={listId}
        onClick={() => setListOpen((o) => !o)}
      >
        {listOpen ? 'Skjul elementliste' : 'Vis elementliste'}
      </button>

      <div id={listId} className={`sidebar__listwrap${listOpen ? '' : ' sidebar__listwrap--collapsed'}`}>
      {!data ? null : hasResults && results ? (
        <SideNavigation className="sidebar__list">
          {results.elements.length > 0 && (
            <SideNavigation.Group title="Elementer">
              {results.elements.map((e) => item(e.name, { element: e.name }, `e-${e.name}`))}
            </SideNavigation.Group>
          )}
          {results.fields.length > 0 && (
            <SideNavigation.Group title="Felter">
              {results.fields.map(({ element, field }) =>
                item(`${field.name} · fra ${field.origin}`, { element: element.name }, `f-${field.name}.${field.origin}`),
              )}
            </SideNavigation.Group>
          )}
          {results.enums.length > 0 && (
            <SideNavigation.Group title="Enums">
              {results.enums.map((e) => item(e.name, { enum: e.name }, `n-${e.name}`))}
            </SideNavigation.Group>
          )}
        </SideNavigation>
      ) : (
        <>
          {query.trim() && <p className="sidebar__empty">Ingen treff for «{query.trim()}»</p>}
          <SideNavigation className="sidebar__list">
            {groups.map((g) => (
              <SideNavigation.ExpandableItem
                key={g.module}
                title={g.label}
                active={g.elements.some((e) => e.name === state.element)}
                defaultOpen={g.elements.some((e) => e.name === state.element)}
              >
                {g.elements.map((e) => item(e.name, { element: e.name }, e.name))}
              </SideNavigation.ExpandableItem>
            ))}
            <SideNavigation.ExpandableItem title="Enums" active={!!state.enum} defaultOpen={!!state.enum}>
              {enums.map((e) => item(e.name, { enum: e.name }, e.name))}
            </SideNavigation.ExpandableItem>
          </SideNavigation>
        </>
      )}
      </div>
    </nav>
  )
}
