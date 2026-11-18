import { Heading1, Heading2 } from '@entur/typography'
import { Table, TableHead, TableBody, TableRow, HeaderCell, DataCell } from '@entur/table'
import type { EnumType, VersionData } from '../types'
import './EnumPage.css'

export interface EnumPageProps {
  enumType: EnumType
  data: VersionData
  onNavigate: (target: { element: string }) => void
}

export function EnumPage({ enumType, data, onNavigate }: EnumPageProps) {
  const usages = data.elements.flatMap((element) =>
    element.fields
      .filter((f) => f.kind === 'enum' && f.type === enumType.name)
      .map((f) => ({ element: element.name, field: f.name })),
  )

  return (
    <div className="enum-page">
      <header className="enum-page__header">
        <Heading1>{enumType.name}</Heading1>
        {enumType.description && <p className="enum-page__description">{enumType.description}</p>}
      </header>

      <section aria-labelledby="enum-page-values">
        <Heading2 id="enum-page-values">Verdier</Heading2>
        {enumType.values.length === 0 ? (
          <p className="enum-page__empty">Ingen verdier funnet i XSD-en</p>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <HeaderCell>Verdi</HeaderCell>
                <HeaderCell>Beskrivelse</HeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {enumType.values.map((v) => (
                <TableRow key={v.value}>
                  <DataCell className="enum-page__value">{v.value}</DataCell>
                  <DataCell>{v.description}</DataCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section aria-labelledby="enum-page-usedby">
        <Heading2 id="enum-page-usedby">Brukes av</Heading2>
        {usages.length === 0 ? (
          <p className="enum-page__empty">Ikke brukt av noe element i denne versjonen</p>
        ) : (
          <ul className="enum-page__usages">
            {usages.map((u) => (
              <li key={`${u.element}.${u.field}`}>
                <button type="button" className="enum-page__link" onClick={() => onNavigate({ element: u.element })}>
                  {u.element}.{u.field}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
