import type { EnumType } from '../types'
import './EnumValueList.css'

export function EnumValueList({ enumType, typeName }: { enumType?: EnumType; typeName: string }) {
  if (!enumType) {
    return <p className="enum-values__empty">Ingen verdier funnet i XSD-en</p>
  }
  return (
    <dl className="enum-values" aria-label={`Verdier for ${typeName}`}>
      {enumType.values.map((v) => (
        <div key={v.value} className="enum-values__item">
          <dt className="enum-values__value">{v.value}</dt>
          <dd className="enum-values__description">{v.description}</dd>
        </div>
      ))}
    </dl>
  )
}
