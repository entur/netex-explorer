import { useState } from 'react'
import { Table, TableHead, TableBody, TableRow, HeaderCell, DataCell } from '@entur/table'
import type { Element, LoadedFile } from '../types'

export function InstanceTab({ element, loadedFile }: { element: Element; loadedFile: LoadedFile }) {
  const instances = loadedFile.instanceMap[element.name] ?? []
  const [selectedIdx, setSelectedIdx] = useState(0)
  const instance = instances[selectedIdx]

  if (instances.length === 0) {
    return (
      <div style={{ padding: '24px 16px', fontSize: '14px', color: 'var(--colors-greys-grey50, #888)' }}>
        Ingen instanser av {element.name} funnet i {loadedFile.filename}
      </div>
    )
  }

  return (
    <div style={{ padding: '16px' }}>
      {instances.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          {instances.map((inst, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedIdx(i)}
              style={{
                fontSize: '12px', padding: '4px 12px', borderRadius: '9999px',
                border: selectedIdx === i ? '1px solid var(--colors-brand-coral, #ff6c6c)' : '1px solid var(--colors-greys-grey80, #e0e0e0)',
                background: selectedIdx === i ? 'var(--colors-brand-coral, #ff6c6c)' : 'transparent',
                color: selectedIdx === i ? 'var(--colors-greys-white, #ffffff)' : 'var(--colors-greys-grey40, #555)',
                fontWeight: selectedIdx === i ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {inst.id || `Instans ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {instance && (
        <>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--colors-greys-grey50, #888)', fontWeight: 600, marginBottom: '8px' }}>
            Attributtverdier
          </div>
          <div style={{ marginBottom: '24px' }}>
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
                    <DataCell><span style={{ fontFamily: 'monospace', color: 'var(--colors-greys-grey40, #555)' }}>{a.value}</span></DataCell>
                    <DataCell style={{ color: 'var(--colors-greys-grey50, #888)' }}>{a.kind}</DataCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--colors-greys-grey50, #888)', fontWeight: 600, marginBottom: '8px' }}>
            Rå XML
          </div>
          <pre style={{ background: 'var(--colors-greys-grey90, #f8f8f8)', border: '1px solid var(--colors-greys-grey80, #e0e0e0)', borderRadius: '8px', padding: '12px', fontSize: '11px', fontFamily: 'monospace', color: 'var(--colors-greys-grey40, #555)', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {instance.rawXml}
          </pre>
        </>
      )}
    </div>
  )
}
