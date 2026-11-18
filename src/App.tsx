import { useCallback, useEffect, useState } from 'react'
import { BannerAlertBox } from '@entur/alert'
import { Loader } from '@entur/loader'
import { AppLayout } from './components/AppLayout'
import { Sidebar } from './components/Sidebar'
import { Toolbar } from './components/Toolbar'
import { fetchManifest, fetchVersion } from './data/loadVersion'
import { readUrlState, toSearch, type UrlState } from './model/urlState'
import type { LoadedFile, VersionData } from './types'

/** Midlertidig stub til oppgave 8 erstatter den med ElementPage. */
function ElementPage({ element, enumName, file }: { element?: string; enumName?: string; file: LoadedFile | null }) {
  return (
    <div>
      <h1>{element ?? enumName ?? 'Velg et element'}</h1>
      {file && <p>Fil: {file.filename}</p>}
    </div>
  )
}

export default function App() {
  const [state, setState] = useState<UrlState>(() => readUrlState(window.location.search))
  const [versions, setVersions] = useState<string[]>([])
  const [data, setData] = useState<VersionData | null>(null)
  const [failedVersion, setFailedVersion] = useState<string | null>(null)
  const [loadedFile, setLoadedFile] = useState<LoadedFile | null>(null)

  useEffect(() => {
    const onPop = () => setState(readUrlState(window.location.search))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchManifest()
      .then((m) => {
        if (!cancelled) setVersions(m.versions.filter((v) => !('error' in v)).map((v) => v.version))
      })
      .catch(() => {
        if (!cancelled) setVersions([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchVersion(state.v)
      .then((d) => {
        if (cancelled) return
        setData(d)
        setFailedVersion(null)
      })
      .catch(() => {
        if (!cancelled) setFailedVersion(state.v)
      })
    return () => {
      cancelled = true
    }
  }, [state.v])

  const update = useCallback((next: UrlState) => {
    window.history.pushState(null, '', `${import.meta.env.BASE_URL}${toSearch(next)}`)
    setState(next)
  }, [])

  const failed = failedVersion === state.v
  const loading = !failed && data?.version !== state.v
  const current = data?.version === state.v ? data : null

  let notice: string | null = null
  if (current) {
    if (state.element && !current.elements.some((e) => e.name === state.element)) {
      notice = `${state.element} finnes ikke i ${state.v}`
    } else if (state.enum && !current.enums[state.enum]) {
      notice = `${state.enum} finnes ikke i ${state.v}`
    }
  }

  const versionOptions = versions.includes(state.v) || versions.length === 0 ? versions : [...versions, state.v]

  return (
    <AppLayout
      sidebar={
        <Sidebar
          data={data}
          state={state}
          onNavigate={(target) => update({ v: state.v, tab: state.tab, ...target })}
        />
      }
      toolbar={
        <Toolbar
          versions={versionOptions}
          version={state.v}
          onVersionChange={(v) => update({ ...state, v })}
          examples={data?.examples ?? []}
          onFileLoaded={setLoadedFile}
        />
      }
    >
      {failed ? (
        <BannerAlertBox variant="negative" title="Kunne ikke laste data">
          Kunne ikke laste data for {failedVersion}
        </BannerAlertBox>
      ) : loading ? (
        <Loader>Laster {state.v} …</Loader>
      ) : (
        <>
          {notice && <BannerAlertBox variant="warning">{notice}</BannerAlertBox>}
          <ElementPage element={state.element} enumName={state.enum} file={loadedFile} />
        </>
      )}
    </AppLayout>
  )
}
