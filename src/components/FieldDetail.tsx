import type { Field, VersionData } from '../types'
import { KindBadge } from './KindBadge'
import { EnumValueList } from './EnumValueList'
import './FieldDetail.css'

export interface FieldDetailProps {
  field: Field
  data: VersionData
  onNavigate: (target: { element: string } | { enum: string }) => void
}

function occurs(f: Field): string {
  return `${f.minOccurs}..${f.maxOccurs === 'unbounded' ? '*' : f.maxOccurs}`
}

export function FieldDetail({ field: f, data, onNavigate }: FieldDetailProps) {
  const refTarget = f.kind === 'ref' ? f.refTarget : undefined
  const target: { element: string } | { enum: string } | null =
    f.kind === 'enum' && data.enums[f.type]
      ? { enum: f.type }
      : refTarget && data.elements.some((e) => e.name === refTarget)
        ? { element: refTarget }
        : f.kind === 'complex' && data.elements.some((e) => e.name === f.type)
          ? { element: f.type }
          : null
  return (
    <section className="field-detail" aria-label={`Detaljer for ${f.name}`}>
      <h3 className="field-detail__name">{f.isAttribute ? `@${f.name}` : f.name}</h3>
      <dl className="field-detail__facts">
        <dt>Type</dt>
        <dd>
          <KindBadge field={f} />{' '}
          {target ? (
            <button type="button" className="field-detail__link" onClick={() => onNavigate(target)}>
              {refTarget ?? f.type}
            </button>
          ) : (
            <span>{refTarget ?? f.type}</span>
          )}
        </dd>
        <dt>Antall</dt>
        <dd>{occurs(f)}</dd>
        <dt>Påkrevd</dt>
        <dd>{f.required ? 'Ja' : 'Nei'}</dd>
        {f.choice && (
          <>
            <dt>Valg</dt>
            <dd>én av ({f.choice.minOccurs}..{f.choice.maxOccurs === 'unbounded' ? '*' : f.choice.maxOccurs})</dd>
          </>
        )}
        <dt>Fra</dt>
        <dd>{f.origin}</dd>
      </dl>
      {f.description && <p className="field-detail__description">{f.description}</p>}
      {f.kind === 'enum' && <EnumValueList enumType={data.enums[f.type]} typeName={f.type} />}
    </section>
  )
}
