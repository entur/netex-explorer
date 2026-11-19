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
fra `main` hver natt, men jobben henter først `data/explanations-cache.json` fra den åpne PR-grenen, slik at
uferdig arbeid og rettelser fortsetter; er det ingen endringer, blir ingen PR åpnet (og en åpen en lukkes). Dataoppdateringen
(`update`-jobben) committer bare XSD-data og tar aldri med `explanations-*.json`. Feiler `explain`, feiler bare den jobben.
Jobben kjører i GitHub-miljøet `prd` som tjenestekontoen fra `.entur/cicd.yaml`, kaller Vertex AI i prosjektet
`ent-netex-prd`, og kjører bare når repo-variabelen `EXPLAIN_ENABLED` er `true` (av/på-bryter for modellkallene).

### Gjennomgang av PR-en

PR-beskrivelsen (`explain-summary.md`) oppsummerer hva som er nytt, endret og fjernet. Den første PR-en inneholder
rundt 2800 kall som gir omtrent 12 000 unike tekster (rundt 6800 per versjonsfil). Hver versjonsfil er stor, så
første diff er flere MB og GitHub viser ikke diffen av hurtigbufferen. Sjekk heller ut `ki-forklaringer` lokalt, kjør
`npm run dev` og gjør stikkprøver på tvers av versjoner og elementtyper i stedet for å lese alt. Senere PR-er er små.
Merge først når tekstene ser riktige ut.

Rett opp en tekst ved å endre `output` i oppføringen i `data/explanations-cache.json` (på PR-grenen eller i en
oppfølgings-PR). Ikke rediger `public/data/explanations-*.json`; de bygges på nytt fra hurtigbufferen hver kjøring.

### Kjøre lokalt

Krever at du selv har `roles/aiplatform.user` i `ent-netex-prd`. Uten det er det enklere å prøve via CI (se under).
Forkast filene etterpå (`git checkout -- data public/data`); KI-tekst skal bare inn via PR.

```bash
gcloud auth application-default login
GOOGLE_CLOUD_PROJECT=ent-netex-prd MAX_REQUESTS=20 npm run explain   # prøvekjøring med 20 kall
```

| Variabel | Standard | Betydning |
| --- | --- | --- |
| `GOOGLE_CLOUD_PROJECT` | (påkrevd lokalt; `ent-netex-prd` i CI) | GCP-prosjektet med Vertex AI |
| `GOOGLE_CLOUD_LOCATION` | `eu` | Vertex AI-lokasjon (EU-multiregionen) |
| `GEMINI_MODEL` | `gemini-3.7-flash` | Modellen som brukes; må være godkjent i KI-registeret |
| `MAX_REQUESTS` | `2000` | Tak på antall kall per kjøring |

I CI kan `GOOGLE_CLOUD_LOCATION` og `GEMINI_MODEL` overstyres med repo-variabler med samme navn.

Første fulle kjøring trenger rundt 2800 kall på tvers av de fire versjonene, altså mer enn standardtaket. Siden
hurtigbufferen føres videre fra PR-grenen, fortsetter uferdig arbeid neste natt: to netter med standardtaket, eller én
kjøring av `update-data.yml` manuelt (`workflow_dispatch`) med `max_requests=3000`.

Etter at du har endret `GEMINI_MODEL` eller `PROMPT_VERSION` (i `scripts/explain/prompt.js`), må alle tekster lages på
nytt. Kjør da `workflow_dispatch` med `max_requests=3000`; ellers viser PR-en rundt 30 % av tekstene som fjernet i en
natt. Standardversjonen (v2.0) forklares først, så et tak fyller det brukerne ser først.

### Oppsett

GCP-prosjekt og GitHub-tilgang lages med Enturs selvbetjening (plattformorkestratoren), som er eneste godkjente vei.
Mønsteret er det samme som i `entur/ai-registry`.

1. **Selvbetjeningsmanifester** i `.entur/`: `cicd.yaml` (`GitHubActions`, gir GitHub-miljøet `prd` med
   `WORKLOAD_IDENTITY_PROVIDER` og `SERVICE_ACCOUNT`) og `netex.yaml` (`GoogleCloudApplication`, gir prosjektet
   `ent-netex-prd` og tilstandsbøtta `ent-gcs-tfa-netex`). Kommenter `entur apply` på PR-en som legger dem til, vent til
   den er ferdig, og merge.
2. **Terraform** i `terraform/` aktiverer Vertex AI API og gir prd-miljøets GitHub-tjenestekonto
   `roles/aiplatform.user`. Sett `github_service_account` i `terraform/env/prd.tfvars` til `SERVICE_ACCOUNT` fra
   GitHub-miljøet `prd` (*Settings → Environments → prd*). `terraform-apply.yml` kjører ved merge til `main` når
   `terraform/` er endret; `terraform-plan.yml` kan kjøres manuelt.
3. **Budsjettvarsel** på `ent-netex-prd`.
4. Slå på *Allow GitHub Actions to create and approve pull requests* under *Settings → Actions → General*.
5. **Registrer bruken i KI-løypa**: <https://ki.entur.no/ki-loypa>.
6. **Prøvekjøring**: sett repo-variabelen `EXPLAIN_ENABLED` til `true` og kjør `update-data.yml` manuelt med
   `max_requests=20`. Se over språket i PR-en som kommer, og la den stå åpen. Kjør så med `max_requests=3000` for første
   fulle kjøring (rundt én time). Den henter hurtigbufferen fra PR-grenen, beholder prøvetekstene og oppdaterer samme PR.
   Sett `EXPLAIN_ENABLED` til noe annet enn `true` for å slå av modellkallene uten å stoppe dataoppdateringen.

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

Se [CONTRIBUTING.md](CONTRIBUTING.md) for hvordan du melder feil, retter KI-forklaringer og sender inn endringer.
Planer og design-dokumenter ligger i [docs/superpowers/](docs/superpowers/).

## Lisens

[EUPL-1.2](LICENSE)
