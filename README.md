# NeTEx-utforsker

Interaktiv utforsker for NeTEx-standarden (Network Timetable Exchange), bygget med Entur sitt designsystem Linje.

Appen ligger på <https://entur.github.io/netex-explorer/>.

## Funksjoner

- Elementer gruppert etter del og modul, med søk i elementer og felter (også arvede)
- Elementside med felttabell, arvekjede (filtrer på opphav), strukturvisning som XML-tre og XML-instans fra lastet fil
- Enum-sider med verdier og oversikt over hvilke felter som bruker enumen
- Bytte mellom NeTEx-versjoner (v1.3, v2.0, v2.1-wip, v3.0-wip); versjon, element, enum og fane ligger i URL-en
- Last inn NeTEx-eksempler, lokal XML-fil eller limt inn XML og se verdiene til instanser
- Norske forklaringer av elementer og felter, generert av KI (Gemini) og gjennomgått i PR før de publiseres

## Kom i gang

```bash
npm install
npm run fetch-schema        # henter og parser alle versjoner
npm run dev
```

### Hente data

`npm run fetch-schema` henter XSD-ene fra [NeTEx-repoet på GitHub](https://github.com/NeTEx-CEN/NeTEx), parser dem og skriver
`public/data/netex-<versjon>.json` og `public/data/versions.json`. Appen laster disse filene ved kjøring.

Gi versjoner som argument for å hente bare noen:

```bash
npm run fetch-schema -- v2.0
npm run fetch-schema -- v2.0 v1.3
```

### Bygg og forhåndsvis

```bash
npm run build      # tsc -b og vite build
npm run preview
```

#### `BASE_PATH`

Appen kan ligge under en understi. Sett `BASE_PATH` ved bygging (Vite `base`); uten verdi brukes `/`.
All lenking og datahenting går via `import.meta.env.BASE_URL`.

```bash
BASE_PATH=/netex-explorer/ npm run build
```

#### Uniformen

Ved bygging (og ved `npm run dev`) hentes Entur sitt felles skall fra Uniformen
(`https://uniformen.entur.no/ssr?simple=true&locale=nb-NO`, tidsavbrudd 2000 ms) og settes inn i `index.html`.
Feiler kallet, bygges appen uten skall.

### Skrifter

Skriften Nationale kommer fra `@entur/typography`, som leverer `@font-face` og skriftfilene, og de blir med i bygget.
Arial brukes bare som reserve. Nationale er lisensiert for offisielle Entur-produkter.

## Publisering

Appen hostes på GitHub Pages og bygges og publiseres av `.github/workflows/deploy-pages.yml`:

- ved hver push til `main`
- manuelt fra Actions-fanen (`workflow_dispatch`)
- etter den nattlige dataoppdateringen (`update-data.yml`), når den har committet nye data. Den commiten bruker
  `[skip ci]`, så den starter ikke publiseringen av seg selv; `update-data.yml` kaller derfor `deploy-pages.yml` direkte.

Bygget kjører testene først, og `BASE_PATH` settes fra Pages-oppsettet (`/netex-explorer/`). Pages må være satt opp med
**Source: GitHub Actions** under *Settings → Pages* i repoet.

## KI-genererte forklaringer

Appen viser norske forklaringer av elementer og felter. Tekstene genereres på forhånd med Gemini på Vertex AI og
lagres som `public/data/explanations-<versjon>.json`; appen kaller aldri en KI-modell ved kjøring.
`data/explanations-cache.json` husker hva som allerede er forklart, så bare nye eller endrede felter sendes til modellen.

KI-tekst kommer aldri direkte på `main`. Jobben `explain` i `update-data.yml` kjører hver natt etter dataoppdateringen
(også når ingen data er endret), og åpner en PR fra den faste grenen `ki-forklaringer` til `main`. Grenen lages på nytt
fra `main` hver natt; er det ingen endringer, blir ingen PR åpnet (og en åpen en lukkes). Dataoppdateringen
(`update`-jobben) committer bare XSD-data og tar aldri med `explanations-*.json`. Feiler `explain`, feiler bare den jobben.
Jobben kjører bare når repo-variablene `GOOGLE_CLOUD_PROJECT`, `GCP_WIF_PROVIDER` og `GCP_SERVICE_ACCOUNT` er satt.

### Gjennomgang av PR-en

PR-beskrivelsen (`explain-summary.md`) oppsummerer hva som er nytt, endret og fjernet. Den første PR-en inneholder
rundt 6000 tekster; gjør stikkprøver på tvers av versjoner og elementtyper i stedet for å lese alt. Senere PR-er er
små. Merge først når tekstene ser riktige ut; rett opp feil direkte i PR-grenen.

### Kjøre lokalt

```bash
gcloud auth application-default login
GOOGLE_CLOUD_PROJECT=<prosjekt-id> MAX_REQUESTS=20 npm run explain   # prøvekjøring med 20 kall
```

| Variabel | Standard | Betydning |
| --- | --- | --- |
| `GOOGLE_CLOUD_PROJECT` | (påkrevd) | GCP-prosjektet med Vertex AI |
| `GOOGLE_CLOUD_LOCATION` | `europe-west1` | Region for Vertex AI |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Modellen som brukes |
| `MAX_REQUESTS` | `2000` | Tak på antall kall per kjøring |

Første fulle kjøring trenger rundt 2800 kall på tvers av de fire versjonene, altså mer enn standardtaket. Da tar den to
netter, eller kjør `update-data.yml` manuelt (`workflow_dispatch`) og sett inputen `max_requests` høyere.

### Oppsett utenfor repoet

1. GCP-prosjekt med Vertex AI API aktivert.
2. Tjenestekonto med rollen `roles/aiplatform.user`.
3. Workload Identity-pool og provider for GitHub med `attribute-condition`
   `assertion.repository == 'entur/netex-overview' && assertion.ref == 'refs/heads/main'`. Tjenestekontoen må la
   identiteten fra poolen bruke den (`roles/iam.workloadIdentityUser`).
4. Budsjettvarsel på prosjektet.
5. Repo-variabler (*Settings → Secrets and variables → Actions → Variables*): `GOOGLE_CLOUD_PROJECT`,
   `GCP_WIF_PROVIDER` (full ressursnavn for provideren) og `GCP_SERVICE_ACCOUNT` (e-post til tjenestekontoen).
   Valgfritt: `GOOGLE_CLOUD_LOCATION` og `GEMINI_MODEL`.
6. Slå på *Allow GitHub Actions to create and approve pull requests* under *Settings → Actions → General*.
7. Registrer bruken i KI-løypa: <https://ki.entur.no/ki-loypa>.

## NeTEx-versjoner

Versjonslisten kommer fra `public/data/versions.json`. Versjoner som feilet under henting vises ikke i velgeren.
Profiler (nasjonale tilpasninger) støttes ikke; appen viser bare selve NeTEx-standarden.

## Testing

```bash
npm test            # Vitest (watch)
npx vitest run      # én kjøring
npm run lint
```

## Teknologier

React 19, TypeScript (strict), Vite, Entur Linje (`@entur/*`), fast-xml-parser, Vitest og Testing Library.

## Bidra

Se [docs/superpowers/](docs/superpowers/) for planer og design-dokumenter.
