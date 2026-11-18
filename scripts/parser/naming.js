/**
 * Class name shown in the UI for an XSD type name: strips the `Structure` suffix and
 * any `_…Structure` variant ('_VersionStructure', '_VersionedChildStructure', …).
 * @param {string} typeName
 */
export function displayName(typeName) {
  return typeName.replace(/_[A-Za-z]*Structure$/, '').replace(/Structure$/, '')
}
