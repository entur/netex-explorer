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
  if (element.ancestors.length === 0) return null
  const hasFilterable = element.ancestors.some((a) => a.abstract || !data.elements.some((e) => e.name === a.name))

  return (
    <nav className="ancestor-pills" aria-labelledby="ancestor-pills-label">
      <span id="ancestor-pills-label" className="ancestor-pills__label">
        Arvekjede
      </span>
      <ol className="ancestor-pills__list">
        {element.ancestors.map((a) => {
          const navigable = !a.abstract && data.elements.some((e) => e.name === a.name)
          if (navigable) {
            return (
              <li key={a.name} className="ancestor-pills__item">
                <button
                  type="button"
                  className="ancestor-pills__pill"
                  title={`Gå til ${a.name}`}
                  onClick={() => onNavigate({ element: a.name })}
                >
                  {a.name}
                </button>
              </li>
            )
          }
          const active = originFilter === a.name
          return (
            <li key={a.name} className="ancestor-pills__item">
              <button
                type="button"
                aria-pressed={active}
                title={
                  active ? 'Vis alle felter igjen' : `Abstrakt type – vis bare felter som er definert i ${a.name}`
                }
                className={`ancestor-pills__pill ancestor-pills__pill--abstract${active ? ' ancestor-pills__pill--active' : ''}`}
                onClick={() => onOriginFilter(active ? null : a.name)}
              >
                {a.name}
              </button>
            </li>
          )
        })}
        <li className="ancestor-pills__item">
          <span className="ancestor-pills__pill ancestor-pills__pill--self" aria-current="true">
            {element.name}
          </span>
        </li>
      </ol>
      {originFilter ? (
        <p className="ancestor-pills__hint">
          Viser bare felter definert i <em>{originFilter}</em>.{' '}
          <button type="button" className="ancestor-pills__clear" onClick={() => onOriginFilter(null)}>
            Vis alle
          </button>
        </p>
      ) : (
        hasFilterable && (
          <p className="ancestor-pills__hint">
            Fra den mest generelle typen til venstre til denne. Klikk en <em>abstrakt</em> type for å se bare
            feltene den bidrar med.
          </p>
        )
      )}
    </nav>
  )
}
