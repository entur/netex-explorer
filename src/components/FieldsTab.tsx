import { useState, type ReactNode } from 'react'
import { Table, TableHead, TableBody, TableRow, HeaderCell, DataCell, ExpandableRow, ExpandRowButton } from '@entur/table'
import { FilterChip } from '@entur/chip'
import { Tag } from '@entur/layout'
import { Tooltip } from '@entur/tooltip'
import { VisuallyHidden } from '@entur/a11y'
import type { Element, Field, VersionData } from '../types'
import { countFields, filterFields, type FieldFilter } from '../model/fieldFilters'
import { KindBadge } from './KindBadge'
import { EnumValueList } from './EnumValueList'
import './FieldsTab.css'

export interface FieldsTabProps {
  element: Element
  data: VersionData
  originFilter: string | null
  onNavigate: (target: { element: string } | { enum: string }) => void
}

const CHIPS: { value: FieldFilter; label: string }[] = [
  { value: 'alle', label: 'Alle' },
  { value: 'egne', label: 'Egne' },
  { value: 'arvet', label: 'Arvet' },
  { value: 'pakrevd', label: 'Påkrevd' },
  { value: 'enums', label: 'Enums' },
]

function occurs(f: Field): string {
  const max = f.maxOccurs === 'unbounded' ? '*' : f.maxOccurs
  return `${f.minOccurs}..${max}`
}

export function FieldsTab({ element, data, originFilter, onNavigate }: FieldsTabProps) {
  const [filter, setFilter] = useState<FieldFilter>('alle')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const counts = countFields(element)
  const rows = filterFields(element, filter).filter((f) => !originFilter || f.origin === originFilter)
  const hasElement = (name: string) => data.elements.some((e) => e.name === name)

  const link = (name: string, target: { element: string } | { enum: string }, exists: boolean): ReactNode =>
    exists ? (
      <button type="button" className="fields-tab__link" onClick={() => onNavigate(target)}>
        {name}
      </button>
    ) : (
      <span>{name}</span>
    )

  const typeCell = (f: Field): ReactNode => {
    if (f.kind === 'enum') return link(f.type, { enum: f.type }, !!data.enums[f.type])
    if (f.kind === 'ref') {
      const t = f.refTarget
      return t ? link(t, { element: t }, hasElement(t)) : <span>{f.type}</span>
    }
    if (f.kind === 'list' && f.contains?.length) {
      return (
        <>
          {f.contains.map((c, i) => (
            <span key={c.name}>
              {i > 0 && ', '}
              {link(c.name, { element: c.name }, hasElement(c.name))}
            </span>
          ))}
        </>
      )
    }
    if (f.kind === 'complex') return link(f.type, { element: f.type }, hasElement(f.type))
    return <span>{f.type}</span>
  }

  const choiceCell = (f: Field): ReactNode => {
    if (!f.choice) return null
    const others = element.fields.filter((o) => o.choice?.id === f.choice!.id && o !== f).map((o) => o.name)
    return (
      <Tooltip placement="top" content={others.length ? `Alternativer: ${others.join(', ')}` : 'Ingen andre alternativer'}>
        <span tabIndex={0} className="fields-tab__choice">
          <Tag size="small">én av</Tag>
        </span>
      </Tooltip>
    )
  }

  return (
    <div className="fields-tab">
      <div className="fields-tab__chips" role="group" aria-label="Filtrer felter">
        {CHIPS.map((c) => (
          <FilterChip
            key={c.value}
            value={c.value}
            checked={filter === c.value}
            onChange={() => setFilter(c.value)}
          >
            {c.label} {counts[c.value]}
          </FilterChip>
        ))}
      </div>
      <Table>
        <TableHead>
          <TableRow>
            <HeaderCell>Felt</HeaderCell>
            <HeaderCell>Type</HeaderCell>
            <HeaderCell>Antall</HeaderCell>
            <HeaderCell>Fra</HeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.flatMap((f) => {
            const key = `${f.origin}/${f.isAttribute ? '@' : ''}${f.name}`
            const isOpen = open.has(key)
            const toggle = () =>
              setOpen((prev) => {
                const next = new Set(prev)
                if (next.has(key)) next.delete(key)
                else next.add(key)
                return next
              })
            const main = (
              <TableRow key={key}>
                <DataCell>
                  {f.kind === 'enum' && (
                    <ExpandRowButton open={isOpen} onClick={toggle} aria-label={`${isOpen ? 'Skjul' : 'Vis'} verdier for ${f.name}`} />
                  )}
                  <span className="fields-tab__name">{f.name}</span>
                  {f.required && (
                    <span className="fields-tab__required" aria-hidden="true">
                      {' '}*
                    </span>
                  )}
                  {f.required && <VisuallyHidden>påkrevd</VisuallyHidden>}{' '}
                  {choiceCell(f)}
                </DataCell>
                <DataCell>
                  <KindBadge field={f} /> {typeCell(f)}
                </DataCell>
                <DataCell>{occurs(f)}</DataCell>
                <DataCell>{f.origin}</DataCell>
              </TableRow>
            )
            if (f.kind === 'enum' && isOpen) {
              return [
                main,
                <ExpandableRow key={`${key}#open`} colSpan={4} open>
                  <EnumValueList enumType={data.enums[f.type]} typeName={f.type} />
                </ExpandableRow>,
              ]
            }
            return [main]
          })}
        </TableBody>
      </Table>
    </div>
  )
}
