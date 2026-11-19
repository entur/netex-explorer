/** Kildekoden til utforskeren */
export const REPO_URL = 'https://github.com/entur/netex-explorer'

export interface ExplanationIssue {
  /** NeTEx-versjonen forklaringen gjelder, f.eks. v2.0 */
  version: string
  /** Hva forklaringen gjelder: element- eller enumnavn, eller <type>.<felt> */
  subject: string
  /** Forklaringen slik den står i appen */
  text: string
}

/**
 * Lenke til et nytt issue med malen for feil i KI-forklaringer, der versjon, hva den gjelder og teksten er fylt ut.
 * Feltnavnene er id-ene i .github/ISSUE_TEMPLATE/ki-forklaring.yml.
 */
export function explanationIssueUrl({ version, subject, text }: ExplanationIssue): string {
  const params = new URLSearchParams({
    template: 'ki-forklaring.yml',
    title: `Feil i KI-forklaring: ${subject} (${version})`,
    versjon: version,
    gjelder: subject,
    tekst: text,
  })
  return `${REPO_URL}/issues/new?${params}`
}
