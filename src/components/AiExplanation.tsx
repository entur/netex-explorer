import { NewIcon } from '@entur/icons'
import { Tag } from '@entur/layout'
import { Heading5 } from '@entur/typography'
import './AiExplanation.css'

export function AiExplanation({ text }: { text: string | undefined }) {
  if (!text) return null
  return (
    <aside className="ai-explanation" aria-label="Forklaring (KI-generert)">
      <div className="ai-explanation__header">
        {/* Ikke en ekte overskrift (h5), så sidens overskriftsstruktur ikke forstyrres */}
        <Heading5 as="p" margin="none">
          Forklaring
        </Heading5>
        <Tag variant="lavender" className="ai-explanation__tag">
          {/* Tre gnister: Linje-ikonet «new», som Uniformen også bruker for KI. Teksten bærer meningen. */}
          <NewIcon aria-hidden="true" />
          KI-generert
        </Tag>
      </div>
      <p className="ai-explanation__text">{text}</p>
      <p className="ai-explanation__note">Laget av KI og kan inneholde feil. Beskrivelsen fra XSD-en er den offisielle.</p>
    </aside>
  )
}
