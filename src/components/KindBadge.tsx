import type { Field } from '../types'
import './KindBadge.css'

const COLORED = ['enum', 'ref', 'list', 'complex']

function kindLabel(field: Field): string {
  if (field.kind === 'enum' && field.isList) return 'liste av enum'
  if (field.kind === 'unknown') return 'ukjent'
  return field.kind
}

/** Typemerke med fast farge per art; XML-attributter får i tillegg et «@». */
export function KindBadge({ field }: { field: Field }) {
  const variant = COLORED.includes(field.kind) ? field.kind : 'other'
  return (
    <span className={`kind-badge kind-badge--${variant}`}>
      {field.isAttribute && (
        <span className="kind-badge__attr" title="XML-attributt">
          @
        </span>
      )}
      {kindLabel(field)}
    </span>
  )
}
