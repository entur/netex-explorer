import { useState } from 'react'
import { Heading3 } from '@entur/typography'
import { Table, TableHead, TableBody, TableRow, HeaderCell, DataCell } from '@entur/table'
import type { Element, LoadedFile } from '../types'
import './InstanceTab.css'

export function InstanceTab({ element, loadedFile }: { element: Element; loadedFile: LoadedFile }) {
  const instances = loadedFile.instanceMap[element.name] ?? []
  const [selectedIdx, setSelectedIdx] = useState(0)
  const instance = instances[selectedIdx]

  if (instances.length === 0) {
    return <p className="instance-tab__empty">Ingen instanser av {element.name} funnet i {loadedFile.filename}</p>
  }

  return (
    <div className="instance-tab">
      {instances.length > 1 && (
        <div className="instance-tab__picker" role="group" aria-label="Instanser">
          {instances.map((inst, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={selectedIdx === i}
              className={`instance-tab__pill${selectedIdx === i ? ' instance-tab__pill--active' : ''}`}
              onClick={() => setSelectedIdx(i)}
            >
              {inst.id || `Instans ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {instance && (
        <>
          <section>
            <Heading3>Attributtverdier</Heading3>
            <div className="table-scroll">
            <Table>
              <TableHead>
                <TableRow>
                  <HeaderCell>Attributt</HeaderCell>
                  <HeaderCell>Verdi</HeaderCell>
                  <HeaderCell>Type</HeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {instance.attributes.map((a) => (
                  <TableRow key={a.name}>
                    <DataCell>{a.name}</DataCell>
                    <DataCell className="instance-tab__value">{a.value}</DataCell>
                    <DataCell className="instance-tab__kind">{a.kind}</DataCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </section>

          <section>
            <Heading3>Rå XML</Heading3>
            <pre className="instance-tab__xml">{instance.rawXml}</pre>
          </section>
        </>
      )}
    </div>
  )
}
