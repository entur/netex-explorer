import { createContext, useContext } from 'react'
import type { Explanations } from '../types'

export const ExplanationsContext = createContext<Explanations | null>(null)

/** Slår opp KI-forklaring; undefined når filen mangler eller nøkkelen ikke finnes. */
export function useExplanation(kind: 'types' | 'fields' | 'enums', key: string): string | undefined {
  const explanations = useContext(ExplanationsContext)
  const map = explanations?.[kind]
  return map && Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined
}
