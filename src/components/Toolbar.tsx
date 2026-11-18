import { Dropdown } from '@entur/dropdown'
import type { NormalizedDropdownItemType } from '@entur/dropdown'
import { ExampleLoader } from './ExampleLoader'
import type { LoadedFile, NeTExExample } from '../types'
import './Toolbar.css'

export interface ToolbarProps {
  versions: string[]
  version: string
  onVersionChange: (version: string) => void
  examples: NeTExExample[]
  onFileLoaded: (file: LoadedFile | null) => void
}

export function Toolbar({ versions, version, onVersionChange, examples, onFileLoaded }: ToolbarProps) {
  const items: NormalizedDropdownItemType<string>[] = versions.map((v) => ({ value: v, label: v }))
  const selected = items.find((i) => i.value === version) ?? null
  return (
    <div className="toolbar">
      <div className="toolbar__version">
        <Dropdown
          label="Versjon"
          items={items}
          selectedItem={selected}
          onChange={(item) => {
            if (item) onVersionChange(item.value)
          }}
        />
      </div>
      <ExampleLoader examples={examples} onFileLoaded={onFileLoaded} />
    </div>
  )
}
