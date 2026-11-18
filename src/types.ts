/** Datamodell skrevet av XSD-parseren til public/data/netex-<versjon>.json */
export type FieldKind =
  | 'enum'
  | 'ref'
  | 'list'
  | 'complex'
  | 'string'
  | 'boolean'
  | 'integer'
  | 'decimal'
  /** Typen er ikke xsd:* og finnes ikke i XSD-filene som er lest inn (f.eks. gml:) */
  | 'unknown'

export interface Choice {
  id: string
  minOccurs: string
  maxOccurs: string
}

export interface ContainedElement {
  name: string
  minOccurs: string
  maxOccurs: string
  /** true: `<xsd:element ref="name">` (globalt element); false: lokal deklarasjon med egen `type` */
  ref: boolean
  /** Deklarert type for lokale elementer (nøkkel i `structures` hvis den er en complexType) */
  type?: string
}

export interface Field {
  name: string
  type: string
  kind: FieldKind
  isAttribute: boolean
  isList: boolean
  minOccurs: string
  maxOccurs: string
  required: boolean
  choice?: Choice
  /** Elementet (eller typen) feltet er definert på */
  origin: string
  description: string
  contains?: ContainedElement[]
  /**
   * Elementet feltet peker på: for `kind: 'ref'` det som refereres (kan være abstrakt og mangle i `elements`);
   * for `<xsd:element ref="X">` ellers X når X er et konkret element; X når X er et abstrakt hode (nøkkel i `substitutions`).
   */
  refTarget?: string
  /** Navn i `VersionData.structures` */
  structure?: string
}

export interface Ancestor {
  name: string
  abstract: boolean
}

export interface Element {
  name: string
  abstract: boolean
  part: 0 | 1 | 2 | 3
  /** Rå modulnavn, f.eks. 'stopPlace' (leselig etikett lages i navigation.ts) */
  module: string
  description: string
  ancestors: Ancestor[]
  fields: Field[]
}

export interface EnumValue {
  value: string
  description: string
}

export interface EnumType {
  name: string
  description: string
  values: EnumValue[]
}

export interface NeTExExample {
  filename: string
  label: string
  xml: string
}

export interface ParsedInstanceAttribute {
  name: string
  value: string
  kind: FieldKind
}

export interface ParsedInstance {
  id: string
  elementName: string
  attributes: ParsedInstanceAttribute[]
  rawXml: string
}

/** Map from NeTEx element name to all its instances found in a loaded XML file */
export type InstanceMap = Record<string, ParsedInstance[]>

export interface LoadedFile {
  filename: string
  instanceMap: InstanceMap
}

// --- Versjonshåndtering ---

export type VersionManifestEntry =
  | { version: string; file: string; elementCount: number; enumCount: number; fetchedAt: string }
  | { version: string; error: string }

export interface VersionManifest {
  generatedAt: string
  versions: VersionManifestEntry[]
}

export interface VersionData {
  version: string
  fetchedAt: string
  elements: Element[]
  enums: Record<string, EnumType>
  structures: Record<string, Field[]>
  /** Abstrakt element (substitusjonsgruppe-hode) → konkrete elementer som kan stå i stedet, sortert */
  substitutions: Record<string, string[]>
  examples: NeTExExample[]
}

/** Forhåndsgenererte KI-forklaringer for én versjon (public/data/explanations-<versjon>.json) */
export interface Explanations {
  version: string
  model: string
  generatedAt: string
  /** Elementnavn → forklaring */
  types: Record<string, string>
  /** `<origin>.<feltnavn>` → forklaring */
  fields: Record<string, string>
  /** Enumnavn → forklaring */
  enums: Record<string, string>
}
