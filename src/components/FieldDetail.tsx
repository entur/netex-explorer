import type { Field, VersionData } from '../types'
import { fieldLabel } from '../model/elementName'
import { KindBadge } from './KindBadge'
import { EnumValueList } from './EnumValueList'
import { AbstractHead, ElementName } from './ElementRef'
import { AiExplanation } from './AiExplanation'
import { useExplanation } from '../model/explanations'
import './FieldDetail.css'

export interface FieldDetailProps {
  field: Field
  data: VersionData
  onNavigate: (target: { element: string } | { enum: string }) => void
}

function occurs(f: Field): string {
  return `${f.minOccurs}..${f.maxOccurs === 'unbounded' ? '*' : f.maxOccurs}`
}

function TypeValue({ field: f, data, onNavigate }: FieldDetailProps) {
  if (f.kind === 'enum' && data.enums[f.type]) {
    return (
      <button type="button" className="field-detail__link" onClick={() => onNavigate({ enum: f.type })}>
        {f.type}
      </button>
    )
  }
  const members = f.refTarget ? data.substitutions[f.refTarget] : undefined
  if (members) return <AbstractHead name={f.refTarget!} members={members} onNavigate={onNavigate} />
  if (f.refTarget) return <ElementName name={f.refTarget} data={data} onNavigate={onNavigate} />
  return <span>{f.type}</span>
}

export function FieldDetail({ field: f, data, onNavigate }: FieldDetailProps) {
  const explanation = useExplanation('fields', `${f.origin}.${f.name}`)
  return (
    <section className="field-detail" aria-label={`Detaljer for ${fieldLabel(f)}`}>
      <h3 className="field-detail__name">{fieldLabel(f)}</h3>
      <dl className="field-detail__facts">
        <dt>Type</dt>
        <dd>
          <KindBadge field={f} /> <TypeValue field={f} data={data} onNavigate={onNavigate} />
          {f.kind === 'unknown' && <p className="field-detail__unknown">Typen finnes ikke i XSD-filene som er lest inn</p>}
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
      <AiExplanation text={explanation} />
      {f.kind === 'enum' && <EnumValueList enumType={data.enums[f.type]} typeName={f.type} />}
    </section>
  )
}
