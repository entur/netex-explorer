# Bidra til NeTEx-utforskeren

Takk for at du vil bidra! Utforskeren er åpen kildekode under [EUPL-1.2](LICENSE), og alle kan melde feil, foreslå
forbedringer eller sende inn endringer.

## Meld feil eller foreslå noe

Opprett et [issue](https://github.com/entur/netex-explorer/issues/new/choose) og velg riktig mal:

- **Feil i appen**: noe virker ikke, eller viser noe annet enn XSD-en sier.
- **Forslag**: noe du savner eller ønsker annerledes.
- **Feil i KI-forklaring**: en norsk forklaring er feil, misvisende eller uklar. Det enkleste er å trykke
  «Meld feil i forklaringen» nederst i forklaringsboksen i appen. Da er versjon, element eller felt og teksten fylt ut.

## Kom i gang med koden

Du trenger Node.js 24.

```bash
npm install
npm run dev          # appen på http://localhost:5173
```

Dataene i `public/data/` er sjekket inn, så du trenger ikke hente skjemaene for å utvikle. `npm run fetch-schema`
henter dem på nytt fra NeTEx-repoet (se README).

### Før du sender inn

```bash
npx vitest run       # tester
npm run lint
npm run build        # typesjekk og bygg
```

Alle tre kjører også automatisk på hver pull request (`.github/workflows/ci.yml`).

## Send inn en endring

1. Lag en gren fra `main` og gjør endringen. Skriv tester for ny oppførsel.
2. Bruk [Conventional Commits](https://www.conventionalcommits.org/) i commit-meldingene, for eksempel
   `feat(ui): …`, `fix(data): …` eller `docs: …`.
3. Åpne en pull request mot `main` og beskriv hva og hvorfor. Sjekkene i CI må være grønne før merge.
4. Når PR-en er merget, publiseres appen automatisk på GitHub Pages.

Kode, kommentarer og tekster i appen skrives på norsk bokmål. Bruk Entur sitt designsystem Linje (`@entur/*`) og
tokens i stedet for hardkodede farger, så lys og mørk modus virker.

## KI-genererte forklaringer

Forklaringene lages hver natt av jobben `explain` i `update-data.yml` og kommer som en PR fra grenen
`ki-forklaringer`. Se README for hvordan det fungerer.

- **Rett en tekst** ved å endre `output` i oppføringen i `data/explanations-cache.json`, på PR-grenen eller i en egen PR.
  Ikke rediger `public/data/explanations-*.json`; de bygges på nytt fra hurtigbufferen hver kjøring.
- **Endrer du prompten** i `scripts/explain/prompt.js`, øk `PROMPT_VERSION` slik at alle tekster lages på nytt.
- KI-tekst skal bare inn på `main` gjennom en PR som et menneske har sett over.

## Spørsmål

Opprett et issue, eller ta kontakt med `team-produkt` i Entur.
