import type { Element, VersionData } from '../types'
import './AncestorPills.css'

export interface AncestorPillsProps {
  element: Element
  data: VersionData
  originFilter: string | null
  onOriginFilter: (origin: string | null) => void
  onNavigate: (target: { element: string }) => void
}

export function AncestorPills({ element, data, originFilter, onOriginFilter, onNavigate }: AncestorPillsProps) {
  return (
    <nav className="ancestor-pills" aria-label="Arvekjede">
      {element.ancestors.map((a) => {
        const navigable = !a.abstract && data.elements.some((e) => e.name === a.name)
        if (navigable) {
          return (
            <button key={a.name} type="button" className="ancestor-pills__pill" onClick={() => onNavigate({ element: a.name })}>
              {a.name}
            </button>
          )
        }
        const active = originFilter === a.name
        return (
          <button
            key={a.name}
            type="button"
            aria-pressed={active}
            className={`ancestor-pills__pill ancestor-pills__pill--abstract${active ? ' ancestor-pills__pill--active' : ''}`}
            onClick={() => onOriginFilter(active ? null : a.name)}
          >
            {a.name}
          </button>
        )
      })}
      <span className="ancestor-pills__pill ancestor-pills__pill--self" aria-current="true">
        {element.name}
      </span>
      {originFilter && (
        <button type="button" className="ancestor-pills__clear" onClick={() => onOriginFilter(null)}>
          Vis alle
        </button>
      )}
    </nav>
  )
}
