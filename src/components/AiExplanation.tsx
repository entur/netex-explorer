import { useContext } from 'react'
import { NewIcon } from '@entur/icons'
import { Tag } from '@entur/layout'
import { Heading5, Link } from '@entur/typography'
import { ExplanationsContext } from '../model/explanations'
import { explanationIssueUrl } from '../model/repo'
import './AiExplanation.css'

export interface AiExplanationProps {
  text: string | undefined
  /** Hva forklaringen gjelder (element, enum eller <type>.<felt>); brukes i «Meld feil i forklaringen» */
  subject?: string
}

export function AiExplanation({ text, subject }: AiExplanationProps) {
  const version = useContext(ExplanationsContext)?.version
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
      <p className="ai-explanation__note">
        Laget av KI og kan inneholde feil. Beskrivelsen fra XSD-en er den offisielle.
        {version && subject && (
          <>
            {' '}
            <Link
              href={explanationIssueUrl({ version, subject, text })}
              target="_blank"
              rel="noopener noreferrer"
              external
              ariaLabelExternalIcon="(åpnes i ny fane på GitHub)"
              margin="none"
            >
              Meld feil i forklaringen
            </Link>
          </>
        )}
      </p>
    </aside>
  )
}
