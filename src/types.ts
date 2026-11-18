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

export type AttributeKind = FieldKind

export interface Choice {
  id: string
  minOccurs: string
  maxOccurs: string
}

export interface ContainedElement {
  name: string
  minOccurs: string
  maxOccurs: string
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
  /** Kan peke på et abstrakt element som ikke finnes i `elements` */
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
  kind: AttributeKind
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
  examples: NeTExExample[]
}
