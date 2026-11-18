import type { VersionData, VersionManifest } from '../types'

async function getJson<T>(file: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${file}`)
  if (!response.ok) throw new Error(`Kunne ikke hente ${file}: ${response.status}`)
  return (await response.json()) as T
}

export function fetchManifest(): Promise<VersionManifest> {
  return getJson<VersionManifest>('versions.json')
}

export function fetchVersion(version: string): Promise<VersionData> {
  return getJson<VersionData>(`netex-${version}.json`)
}
