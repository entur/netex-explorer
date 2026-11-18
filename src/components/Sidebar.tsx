import { useMemo, useState } from 'react'
import { TextField, SegmentedControl, SegmentedChoice } from '@entur/form'
import { SideNavigation } from '@entur/menu/beta'
import type { VersionData } from '../types'
import { groupByModule, type PartFilter } from '../model/navigation'
import { search } from '../model/search'
import { toSearch, type UrlState } from '../model/urlState'
import './Sidebar.css'

export interface SidebarProps {
  data: VersionData | null
  state: UrlState
  onNavigate: (target: { element?: string; enum?: string }) => void
}

const PART_CHOICES: { value: string; label: string }[] = [
  { value: 'alle', label: 'Alle' },
  { value: '0', label: 'Rammeverk' },
  { value: '1', label: 'Del 1' },
  { value: '2', label: 'Del 2' },
  { value: '3', label: 'Del 3' },
]

function href(state: UrlState, target: { element?: string; enum?: string }) {
  return `${import.meta.env.BASE_URL}${toSearch({ v: state.v, tab: state.tab, ...target })}`
}

export function Sidebar({ data, state, onNavigate }: SidebarProps) {
  const [query, setQuery] = useState('')
  const [part, setPart] = useState<PartFilter>('alle')

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
          <SegmentedChoice key={c.value} value={c.value}>
            {c.label}
          </SegmentedChoice>
        ))}
      </SegmentedControl>

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
                item(`${element.name}.${field.name}`, { element: element.name }, `f-${element.name}.${field.name}`),
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
    </nav>
  )
}
