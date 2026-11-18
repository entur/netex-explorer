import './AiExplanation.css'

export function AiExplanation({ text }: { text: string | undefined }) {
  if (!text) return null
  return (
    <aside className="ai-explanation" aria-label="Forklaring (KI-generert)">
      <p className="ai-explanation__label">Forklaring (KI-generert)</p>
      <p className="ai-explanation__text">{text}</p>
      <p className="ai-explanation__note">Laget av KI og kan inneholde feil. Beskrivelsen fra XSD-en er den offisielle.</p>
    </aside>
  )
}
