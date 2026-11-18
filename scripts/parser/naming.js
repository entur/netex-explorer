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

/** 'stopPlace' → 'Stop place' */
export function humanizeModule(module) {
  const words = module.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
