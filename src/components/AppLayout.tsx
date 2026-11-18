import type { ReactNode } from 'react'
import { SkipToContent } from '@entur/a11y'
import './AppLayout.css'

export interface AppLayoutProps {
  sidebar: ReactNode
  toolbar?: ReactNode
  children: ReactNode
}

export function AppLayout({ sidebar, toolbar, children }: AppLayoutProps) {
  return (
    <>
      <SkipToContent mainId="main-content">Hopp til innhold</SkipToContent>
      <div className="app-layout">
        <aside className="app-layout__sidebar">{sidebar}</aside>
        <div className="app-layout__content">
          {toolbar && <div className="app-layout__toolbar">{toolbar}</div>}
          <main id="main-content" className="app-layout__main">
            {children}
          </main>
        </div>
      </div>
    </>
  )
}

export default AppLayout
