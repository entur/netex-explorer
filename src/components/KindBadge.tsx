import type { Field } from '../types'
import './KindBadge.css'

const COLORED = ['enum', 'ref', 'list', 'complex']

export function KindBadge({ field }: { field: Field }) {
  const text = field.isAttribute
    ? '@attr'
    : field.isList && field.kind === 'enum'
      ? 'liste av enum'
      : field.kind
  const variant = COLORED.includes(field.kind) ? field.kind : 'other'
  return <span className={`kind-badge kind-badge--${variant}`}>{text}</span>
}
