# Design: GitHub-lenke, bidragsguide og tilbakemelding på KI-forklaringer

**Dato:** 2026-11-19
**Status:** Godkjent 2026-11-19

## Hensikt

Brukerne av utforskeren skal enkelt finne kildekoden og vite hvordan de kan bidra. Det viktigste bidraget fra
fagbrukere er å si fra når en KI-forklaring er feil, så den kan rettes.

## Mål

1. En synlig lenke til `entur/netex-explorer` i appen.
2. `CONTRIBUTING.md` på norsk som forklarer hvordan man kjører, tester og foreslår endringer, og hvordan en KI-tekst rettes.
3. Lisens, slik at andre faktisk kan bidra og gjenbruke koden.
4. Issue-maler for feil, ønsker og feil i KI-forklaringer.
5. En lenke i KI-boksen som åpner et ferdig utfylt issue for akkurat den forklaringen.
6. CI på hver PR (tester, lint, bygg), slik at feil som Vitest 5-oppgraderingen stoppes før `main`.

## Ikke-mål

- Redigering av forklaringer direkte i appen.
- Innlogging eller egen tilbakemeldingstjeneste.
- Automatisk retting av tekster ut fra issues.

## Tilnærminger

1. **Lenke og bidragsguide** (lenke, `CONTRIBUTING.md`, lisens).
2. **Lenke, guide og tilbakemelding på KI-teksten** *(valgt av Sturle)*: som 1, pluss issue-maler og «Meld feil i
   forklaringen» i KI-boksen.

## Design

- **Lisens:** `LICENSE` med EUPL-1.2 (Enturs standard), offisiell tekst hentet fra GitHubs lisens-API.
- **Lenke i verktøylinjen:** Linje `Link` med `GithubIcon` og teksten «Kildekode på GitHub», åpnes i ny fane.
  Repo-URL ligger i én konstant (`src/model/repo.ts`).
- **`CONTRIBUTING.md`:** kom i gang (`npm install`, `npm run dev`), tester og lint, PR-flyt mot `main`,
  hvordan data og KI-forklaringer lages, og hvordan en KI-tekst rettes (i `output` i `data/explanations-cache.json`,
  ikke i `public/data/explanations-*.json`). Lenke til den fra README.
- **Issue-maler** (`.github/ISSUE_TEMPLATE/`, GitHub issue forms):
  - `feil.yml`: feil i appen.
  - `forslag.yml`: ønske eller forslag.
  - `ki-forklaring.yml`: feil i KI-forklaring, med feltene `versjon`, `gjelder` (f.eks. `StopPlace` eller
    `GroupOfEntities.Name`), `tekst` (forklaringen slik den står) og `problem` (hva som er feil, påkrevd).
  - `config.yml` med lenke til bidragsguiden.
- **«Meld feil i forklaringen»:** lenke nederst i KI-boksen med Linje `Link` og `ExternalIcon`. Den åpner
  `…/issues/new?template=ki-forklaring.yml&title=…&versjon=…&gjelder=…&tekst=…`. Versjonen hentes fra
  forklaringsfilen i konteksten. `AiExplanation` får hva forklaringen gjelder som ny prop. Bare offentlig
  NeTEx-informasjon og KI-teksten havner i URL-en.
- **`ci.yml`:** kjører på `pull_request` mot `main`: `npm ci`, `npx vitest run`, `npm run lint`, `npm run build`.
  Bare lesetilgang (`contents: read`). Jobbnavnet `ci` kan kreves av et regelsett på `main` senere.
- **Tester:** URL-byggeren (koding, felt, tittel), at lenken vises med riktig `href` i KI-boksen, og at
  GitHub-lenken vises i verktøylinjen.

## Overlatt til byggeren

- Ordlyd i `CONTRIBUTING.md` og malene.
- Plassering av GitHub-lenken innenfor verktøylinjen.
