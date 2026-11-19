import { Dropdown } from '@entur/dropdown'
import type { NormalizedDropdownItemType } from '@entur/dropdown'
import { GithubIcon } from '@entur/icons'
import { Link } from '@entur/typography'
import { REPO_URL } from '../model/repo'
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
      <div className="toolbar__actions">
        <ExampleLoader examples={examples} onFileLoaded={onFileLoaded} />
        <Link
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          margin="none"
          className="toolbar__repo"
          aria-label="Kildekode på GitHub (åpnes i ny fane)"
        >
          <GithubIcon aria-hidden="true" />
          Kildekode på GitHub
        </Link>
      </div>
    </div>
  )
}
