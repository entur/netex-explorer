import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { VisuallyHidden } from '@entur/a11y'
import { Tag } from '@entur/layout'
import type { Element, VersionData } from '../types'
import { childNodes, rootNodes, type TreeNode } from '../model/structureTree'
import { KindBadge } from './KindBadge'
import { FieldDetail } from './FieldDetail'
import './StructureTab.css'

export interface StructureTabProps {
  element: Element
  data: VersionData
  onNavigate: (target: { element: string } | { enum: string }) => void
}

type Selectable = Exclude<TreeNode, { kind: 'divider' }>

interface Row {
  node: Selectable
  level: number
  parentId: string | null
  path: string[]
  setSize: number
  posInSet: number
  expandable: boolean
  expanded: boolean
}
type Item = Row | { divider: string; key: string; level: number }

function isExpandable(n: Selectable): boolean {
  return n.kind === 'choice' ? n.children.length > 0 : n.expandable
}

function occurs(min: string, max: string) {
  return `${min}..${max === 'unbounded' ? '*' : max}`
}

/*
 * Tilgjengelighet: ARIA tree-mønsteret i flat form (aria-level/posinset/setsize).
 * - Roving tabindex: bare ett treitem har tabIndex 0.
 * - Dividers (origin-skifte) er role="presentation" og ikke fokuserbare.
 * - Choice-noder («én av») er vanlige, fokuserbare treitems som kan foldes ut.
 * - Klikk velger; folding skjer med piltaster eller chevron-knappen (kun mus).
 */
export function StructureTab({ element, data, onNavigate }: StructureTabProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const refs = useRef(new Map<string, HTMLLIElement>())

  const roots = useMemo(() => rootNodes(element, data), [element, data])

  const { items, rows } = useMemo(() => {
    const items: Item[] = []
    const rows: Row[] = []
    const walk = (nodes: TreeNode[], level: number, parentId: string | null, path: string[]) => {
      const real = nodes.filter((n): n is Selectable => n.kind !== 'divider')
      let pos = 0
      nodes.forEach((n, i) => {
        if (n.kind === 'divider') {
          items.push({ divider: n.origin, key: `div:${parentId ?? ''}:${i}`, level })
          return
        }
        const expandable = isExpandable(n)
        const isOpen = expandable && expanded.has(n.id)
        const nodePath = n.kind === 'element' ? [...path, n.name] : path
        const row: Row = { node: n, level, parentId, path: nodePath, setSize: real.length, posInSet: ++pos, expandable, expanded: isOpen }
        items.push(row)
        rows.push(row)
        if (isOpen) walk(childNodes(n, data, nodePath), level + 1, n.id, nodePath)
      })
    }
    walk(roots, 1, null, [element.name])
    return { items, rows }
  }, [roots, expanded, data, element.name])

  const selected = rows.find((r) => r.node.id === selectedId)?.node
  const activeId = rows.some((r) => r.node.id === focusId) ? focusId : rows[0]?.node.id

  const moveTo = (id: string) => {
    setFocusId(id)
    refs.current.get(id)?.focus()
  }
  const setOpen = (id: string, open: boolean) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (open) next.add(id)
      else next.delete(id)
      return next
    })

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    // Hendelser fra innebygde kontroller (f.eks. syklus-lenken) håndteres av kontrollen selv
    if (e.target !== refs.current.get(rows.find((r) => r.node.id === activeId)?.node.id ?? '')) return
    const idx = rows.findIndex((r) => r.node.id === activeId)
    if (idx < 0) return
    const row = rows[idx]
    switch (e.key) {
      case 'ArrowDown':
        if (idx < rows.length - 1) moveTo(rows[idx + 1].node.id)
        break
      case 'ArrowUp':
        if (idx > 0) moveTo(rows[idx - 1].node.id)
        break
      case 'Home':
        moveTo(rows[0].node.id)
        break
      case 'End':
        moveTo(rows[rows.length - 1].node.id)
        break
      case 'ArrowRight':
        if (!row.expandable) return
        if (!row.expanded) setOpen(row.node.id, true)
        else if (rows[idx + 1]?.parentId === row.node.id) moveTo(rows[idx + 1].node.id)
        break
      case 'ArrowLeft':
        if (row.expanded) setOpen(row.node.id, false)
        else if (row.parentId) moveTo(row.parentId)
        break
      case 'Enter':
      case ' ':
        setSelectedId(row.node.id)
        if (row.node.kind === 'element' && row.node.cycle) onNavigate({ element: row.node.name })
        break
      default:
        return
    }
    e.preventDefault()
  }

  const label = (r: Row) => {
    const n = r.node
    if (n.kind === 'choice') {
      return <span className="structure-tab__name">én av ({occurs(n.minOccurs, n.maxOccurs)})</span>
    }
    if (n.kind === 'element') {
      return (
        <>
          <span className="structure-tab__name">{n.label}</span>
          {n.abstract && <Tag size="small">abstrakt</Tag>}
          <span className="structure-tab__meta">{occurs(n.minOccurs, n.maxOccurs)}</span>
          {n.cycle && (
            <button
              type="button"
              className="structure-tab__link"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation()
                onNavigate({ element: n.name })
              }}
            >
              {n.label} (syklus – åpne elementet)
            </button>
          )}
        </>
      )
    }
    const f = n.field
    return (
      <>
        <span className="structure-tab__name">{f.isAttribute ? `@${f.name}` : f.name}</span>
        {f.required && (
          <>
            <span aria-hidden="true">*</span>
            <VisuallyHidden>påkrevd</VisuallyHidden>
          </>
        )}
        <KindBadge field={f} />
        <span className="structure-tab__meta">{f.type}</span>
        <span className="structure-tab__meta">{occurs(f.minOccurs, f.maxOccurs)}</span>
      </>
    )
  }

  const detail = () => {
    if (!selected) return <p className="structure-tab__hint">Velg et felt i treet for å se detaljer.</p>
    if (selected.kind === 'field') return <FieldDetail field={selected.field} data={data} onNavigate={onNavigate} />
    if (selected.kind === 'choice') {
      return (
        <section className="field-detail" aria-label="Detaljer for valg">
          <p>Én av disse feltene kan brukes ({occurs(selected.minOccurs, selected.maxOccurs)}).</p>
        </section>
      )
    }
    const exists = data.elements.some((e) => e.name === selected.name)
    return (
      <section className="field-detail" aria-label={`Detaljer for ${selected.label}`}>
        <h3 className="field-detail__name">{selected.label}</h3>
        {selected.abstract && <Tag size="small">abstrakt</Tag>}
        <p>Antall: {occurs(selected.minOccurs, selected.maxOccurs)}</p>
        {exists ? (
          <button type="button" className="structure-tab__link" onClick={() => onNavigate({ element: selected.name })}>
            Åpne {selected.label}
          </button>
        ) : (
          <p className="structure-tab__hint">Finnes ikke som eget element i XSD-en.</p>
        )}
      </section>
    )
  }

  return (
    <div className="structure-tab">
      <ul role="tree" aria-label={`Struktur for ${element.name}`} className="structure-tab__tree" onKeyDown={onKeyDown}>
        {items.map((it) =>
          'divider' in it ? (
            <li key={it.key} role="presentation" className="structure-tab__divider" style={{ paddingInlineStart: `calc(var(--space-medium) * ${it.level})` }}>
              Fra {it.divider}
            </li>
          ) : (
            <li
              key={it.node.id}
              ref={(el) => {
                if (el) refs.current.set(it.node.id, el)
                else refs.current.delete(it.node.id)
              }}
              role="treeitem"
              aria-level={it.level}
              aria-setsize={it.setSize}
              aria-posinset={it.posInSet}
              aria-expanded={it.expandable ? it.expanded : undefined}
              aria-selected={it.node.id === selectedId}
              tabIndex={it.node.id === activeId ? 0 : -1}
              className={`structure-tab__item${it.node.id === selectedId ? ' structure-tab__item--selected' : ''}`}
              style={{ paddingInlineStart: `calc(var(--space-medium) * ${it.level})` }}
              onFocus={(e) => {
                if (e.target === e.currentTarget) setFocusId(it.node.id)
              }}
              onClick={(e) => {
                e.stopPropagation()
                setFocusId(it.node.id)
                setSelectedId(it.node.id)
              }}
            >
              <span
                className="structure-tab__chevron"
                aria-hidden="true"
                onClick={(e) => {
                  if (!it.expandable) return
                  e.stopPropagation()
                  setFocusId(it.node.id)
                  setOpen(it.node.id, !it.expanded)
                }}
              >
                {it.expandable ? (it.expanded ? '▾' : '▸') : ''}
              </span>
              <span className="structure-tab__content">{label(it)}</span>
            </li>
          ),
        )}
      </ul>
      <div className="structure-tab__detail">{detail()}</div>
    </div>
  )
}
