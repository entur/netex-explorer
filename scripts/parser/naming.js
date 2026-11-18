/**
 * Class name shown in the UI for an XSD type name: strips the `Structure` suffix and
 * any `_…Structure` variant ('_VersionStructure', '_VersionedChildStructure', …).
 * @param {string} typeName
 */
export function displayName(typeName) {
  return typeName.replace(/_[A-Za-z]*Structure$/, '').replace(/Structure$/, '')
}

/** 'xsd/…/netex_ifopt_stopPlace_version.xsd' → 'stopPlace'; '…/netex_ifopt_equipment_support.xsd' → 'equipment' */
export function moduleFromPath(path) {
  const file = path
    .split('/')
    .pop()
    .replace(/\.xsd$/, '')
    .replace(/_(version|support)$/, '')
    .replace(/^netex_/, '')
  return file.split('_').pop()
}

/** Every XSD file is parsed: definitions also live in files without `_version`/`_support` (e.g. netex_utility_types.xsd). */
export function isSchemaFile(name) {
  return name.endsWith('.xsd')
}
