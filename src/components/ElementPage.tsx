import { useState } from 'react'
import { Heading1 } from '@entur/typography'
import { partName } from '../model/parts'
import { VisuallyHidden } from '@entur/a11y'
import { Tag } from '@entur/layout'
import { Tabs, TabList, Tab, TabPanels, TabPanel } from '@entur/tab'
import type { LoadedFile, VersionData } from '../types'
import { humanizeModule } from '../model/navigation'
import { AncestorPills } from './AncestorPills'
import { FieldsTab } from './FieldsTab'
import { StructureTab } from './StructureTab'
import { InstanceTab } from './InstanceTab'
import { AiExplanation } from './AiExplanation'
import { useExplanation } from '../model/explanations'
import './ElementPage.css'

export type ElementTab = 'felter' | 'struktur' | 'xml'
const TABS: ElementTab[] = ['felter', 'struktur', 'xml']

export interface ElementPageProps {
  element: string
  data: VersionData
  tab: ElementTab
  onTab: (tab: ElementTab) => void
  onNavigate: (target: { element: string } | { enum: string }) => void
  file?: LoadedFile | null
}

export function ElementPage({ element: name, data, tab, onTab, onNavigate, file = null }: ElementPageProps) {
  const element = data.elements.find((e) => e.name === name)
  const explanation = useExplanation('types', name)
  const [originState, setOriginState] = useState<{ name: string; origin: string | null }>({ name, origin: null })
  if (!element) return null
  const activeTab: ElementTab = tab === 'xml' && !file ? 'felter' : tab
  const originFilter = originState.name === name ? originState.origin : null
  const setOrigin = (origin: string | null) => setOriginState({ name, origin })

  return (
    <div className="element-page">
      <header className="element-page__header">
        <Heading1>{element.name}</Heading1>
        <div className="element-page__tags">
          <Tag title={partName(element.part).full}>
            {partName(element.part).label}
            <VisuallyHidden> ({partName(element.part).full})</VisuallyHidden>
          </Tag>
          <Tag>{humanizeModule(element.module)}</Tag>
        </div>
        {element.description && <p className="element-page__description">{element.description}</p>}
        <AiExplanation text={explanation} subject={element.name} />
        <AncestorPills
          element={element}
          data={data}
          originFilter={originFilter}
          onOriginFilter={setOrigin}
          onNavigate={onNavigate}
        />
      </header>
      <Tabs index={TABS.indexOf(activeTab)} onChange={(i) => onTab(TABS[i])}>
        <TabList>
          <Tab>Felter</Tab>
          <Tab>Struktur</Tab>
          <Tab disabled={!file}>XML-instans</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <FieldsTab element={element} data={data} originFilter={originFilter} onNavigate={onNavigate} />
          </TabPanel>
          <TabPanel>
            <StructureTab key={element.name} element={element} data={data} onNavigate={onNavigate} />
          </TabPanel>
          <TabPanel>{file && <InstanceTab element={element} loadedFile={file} />}</TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  )
}
