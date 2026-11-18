import type { Explanations, VersionData, VersionManifest } from '../types'

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

/** Henter KI-forklaringer. Gir null ved enhver feil (404, nett, ugyldig JSON, feil versjon). */
export async function fetchExplanations(version: string): Promise<Explanations | null> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/explanations-${version}.json`)
    if (!response.ok) return null
    const body = (await response.json()) as Explanations | null
    if (!body || body.version !== version) return null
    return body
  } catch {
    return null
  }
}
