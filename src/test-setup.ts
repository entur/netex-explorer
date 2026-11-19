import '@testing-library/jest-dom/vitest'

// jsdom: composedPath() inneholder window, og Entur sin useOnClickOutside (brukt av OverflowMenu)
// sender det til Node.contains(), som kaster. Nettlesere returnerer false her.
if (typeof Node !== 'undefined') {
  const originalContains = Node.prototype.contains
  Node.prototype.contains = function (other: Node | null) {
    return other instanceof Node ? originalContains.call(this, other) : false
  }
}
