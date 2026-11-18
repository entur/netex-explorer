import { Tag } from '@entur/layout'
import type { VersionData } from '../types'
import { displayName, elementLink } from '../model/elementName'
import './ElementRef.css'

type Navigate = (target: { element: string }) => void

/** Lenke til et element, eller ren tekst hvis navnet ikke er et element i data. */
export function ElementName({ name, data, onNavigate }: { name: string; data: VersionData; onNavigate: Navigate }) {
  const link = elementLink(name, data)
  return link.target ? (
    <button type="button" className="element-ref__link" onClick={() => onNavigate({ element: link.target! })}>
      {link.label}
    </button>
  ) : (
    <span>{link.label}</span>
  )
}

/** Abstrakt hode: «Navn · abstrakt · én av N: A, B, …» med medlemmene som lenker. */
export function AbstractHead({ name, members, onNavigate }: { name: string; members: string[]; onNavigate: Navigate }) {
  return (
    <span className="element-ref__head">
      <span>{displayName(name)}</span> <Tag size="small">abstrakt</Tag>{' '}
      <span className="element-ref__members">
        én av {members.length}
        {members.length > 0 && ': '}
        {members.map((m, i) => (
          <span key={m}>
            {i > 0 && ', '}
            <button type="button" className="element-ref__link" onClick={() => onNavigate({ element: m })}>
              {m}
            </button>
          </span>
        ))}
      </span>
    </span>
  )
}

/** Et globalt element (ref): abstrakt hode med medlemmer, lenke til elementet, eller ren tekst. */
export function GlobalElement({ name, data, onNavigate }: { name: string; data: VersionData; onNavigate: Navigate }) {
  const members = data.substitutions[name]
  return members ? <AbstractHead name={name} members={members} onNavigate={onNavigate} /> : <ElementName name={name} data={data} onNavigate={onNavigate} />
}
