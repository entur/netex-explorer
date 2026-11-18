import { useState, useRef } from 'react'
import { SecondaryButton, PrimaryButton } from '@entur/button'
import { Modal } from '@entur/modal'
import { OverflowMenu, OverflowMenuItem } from '@entur/menu'
import { TextArea } from '@entur/form'
import type { NeTExExample, LoadedFile } from '../types'
import { parseXmlInstance } from '../utils/xml-instance-parser'
import './ExampleLoader.css'

interface ExampleLoaderProps {
  examples: NeTExExample[]
  onFileLoaded: (file: LoadedFile | null) => void
}

export function ExampleLoader({ examples, onFileLoaded }: ExampleLoaderProps) {
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteXml, setPasteXml] = useState('')
  const [activeFilename, setActiveFilename] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function loadXml(xml: string, filename: string) {
    onFileLoaded({ filename, instanceMap: parseXmlInstance(xml) })
    setActiveFilename(filename)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => loadXml(ev.target!.result as string, file.name)
    reader.readAsText(file)
  }

  function closePaste() {
    setPasteOpen(false)
    setPasteXml('')
  }

  function handlePaste() {
    if (pasteXml.trim()) loadXml(pasteXml.trim(), 'clipboard.xml')
    closePaste()
  }

  function clearFile() {
    onFileLoaded(null)
    setActiveFilename(null)
  }

  return (
    <div className="example-loader">
      {activeFilename ? (
        <div className="example-loader__active">
          <span className="example-loader__filename">{activeFilename}</span>
          <SecondaryButton size="small" onClick={clearFile} aria-label={`Fjern ${activeFilename}`}>
            ✕
          </SecondaryButton>
        </div>
      ) : (
        <span className="example-loader__hint">Analyser NeTEx-filer</span>
      )}

      <OverflowMenu
        aria-label="Last inn NeTEx-eksempel"
        button={<SecondaryButton size="small">Last inn</SecondaryButton>}
        placement="bottom-end"
      >
        {examples.map((ex) => (
          <OverflowMenuItem key={ex.filename} onSelect={() => loadXml(ex.xml, ex.filename)}>
            {ex.label}
          </OverflowMenuItem>
        ))}
        <OverflowMenuItem onSelect={() => fileRef.current?.click()}>Last inn lokal XML-fil…</OverflowMenuItem>
        <OverflowMenuItem onSelect={() => setPasteOpen(true)}>Lim inn XML…</OverflowMenuItem>
      </OverflowMenu>

      <input ref={fileRef} type="file" accept=".xml" hidden onChange={handleFileChange} />

      <Modal open={pasteOpen} onDismiss={closePaste} title="Lim inn NeTEx XML" size="medium">
        <TextArea
          className="example-loader__textarea"
          label="NeTEx XML"
          value={pasteXml}
          onChange={(e) => setPasteXml(e.target.value)}
          resize="none"
          placeholder="<PublicationDelivery ...>...</PublicationDelivery>"
        />
        <div className="example-loader__actions">
          <SecondaryButton size="small" onClick={closePaste}>
            Avbryt
          </SecondaryButton>
          <PrimaryButton onClick={handlePaste}>Last inn</PrimaryButton>
        </div>
      </Modal>
    </div>
  )
}
