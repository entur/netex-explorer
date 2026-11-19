# Design: KI-genererte forklaringer av typer og felter

**Dato:** 2026-11-18
**Status:** Godkjent 2026-11-18
**Branch:** `claude/ai-field-explanations-872a95`

## Hensikt

Beskrivelsene i NeTEx-XSD-ene er korte og tekniske, for eksempel «Reference to a ACCESS LEG. +V2.0». Brukerne av utforskeren
(utviklere som lager NeTEx-eksport og fagfolk i kollektivselskaper) trenger å forstå hva en type eller et felt *betyr* og
*brukes til*. Appen skal derfor vise en forklaring på norsk, laget av en språkmodell, ved siden av den offisielle XSD-teksten.

## Mål

1. Hvert element, hver enum og hvert felt har en forklaring på norsk bokmål som er lettere å forstå enn XSD-teksten.
2. Forklaringene lages på forhånd i CI og publiseres som statiske filer. Appen forblir statisk på GitHub Pages.
3. **Et menneske ser forklaringene før de publiseres.** CI lager en PR med nye og endrede forklaringer; de kommer først ut når
   noen har sett over og merget PR-en. Enturs KI-register har ikke godkjent bruk der KI-tekst når folk utenfor Entur uten
   menneskelig gjennomgang.
4. Bare nye eller endrede typer sendes til modellen. En natt uten endringer i XSD-ene koster ingenting.
5. Appen fungerer som før når en forklaring mangler, eller når forklaringsfilen ikke finnes.

## Ikke-mål

- Spørsmål eller samtale med KI i appen (eventuelt et senere steg med egen tjeneste).
- Forklaring av hver enkelt enum-verdi. Verdiene har allerede beskrivelser i XSD-en; enum-forklaringen kan nevne de viktigste.
- Forklaring av verdier i en innlastet XML-fil.
- Andre språk enn norsk bokmål.
- Et eget verktøy for å redigere eller godkjenne enkeltforklaringer. Gjennomgangen skjer i PR-en; en tekst kan rettes direkte
  i PR-en, men blir overskrevet hvis typen endres og forklaringen lages på nytt.

## Anti-mål

- **Forklaringen må aldri se ut som den offisielle beskrivelsen.** Den merkes tydelig som KI-generert, og XSD-teksten vises alltid
  ved siden av, uendret.
- **Forklaringen må ikke finne på struktur.** Den skal ikke nevne felter, verdier eller arv som ikke finnes i dataene modellen
  fikk. Modellen får bare data fra XSD-en og blir bedt om å holde seg til dem og til allmenn NeTEx/Transmodel-kunnskap.
- **Ingen hemmelige nøkler** i repoet eller i appen. CI logger inn med Workload Identity Federation.
- **Nattkjøringen må ikke stoppe** fordi KI-kallet feiler. Data fra XSD-ene skal fortsatt oppdateres og publiseres.
- **KI-tekst skal aldri havne på `main` uten en PR** som et menneske har merget.

## Begrensninger

- Appen er statisk (React + Vite) og publiseres på GitHub Pages fra `entur/netex-explorer`.
- Data lages av `npm run fetch-schema` i `update-data.yml` hver natt og committes til `public/data/`.
- Enturs KI-register godkjenner Gemini via Vertex AI fra Enturs egne GCP-prosjekter, også fra GitHub Actions, for åpne og
  interne data. NeTEx-skjemaet er offentlig. Direkte Claude API er ikke registrert.
- Omfang per versjon (v2.0): 1543 elementer, 370 enumer, 4552 unike felter på elementer (definerende type + feltnavn) fordelt
  på 660 typer (88 av dem finnes ikke i `elements`), pluss felter fra 171 strukturer i `structures`. På tvers av fire versjoner er det meste likt.

## Tilnærminger

Vurdert:

1. **Forhåndsgenerert i CI med Gemini i Vertex AI** *(valgt)*. Godkjent vei i KI-registeret, ingen nøkkel å forvalte, kjører
   automatisk hver natt. Krever et GCP-prosjekt med Vertex AI og Workload Identity-oppsett for repoet.
2. Forhåndsgenerert lokalt med Claude Code, JSON committes for hånd. Ingen infrastruktur, men nye wip-endringer får ikke
   forklaring før noen kjører skriptet igjen.
3. Forklaring ved behov via en egen proxy-tjeneste. Gir mulighet for oppfølgingsspørsmål, men krever drift, kostnad per kall og
   vern mot misbruk. Utsatt.

Valgt av Sturle: alternativ 1.

## Design

### Hva som forklares, og hvilken kontekst modellen får

Ett kall per **definerende type**, og ett kall per **enum**. Definerende typer er alle verdier av `field.origin` i både
`elements[].fields` og `structures[*]` (strukturtreet viser også felter fra `structures`), pluss elementer uten egne felter.

**Kanonisk feltvariant** *(byggerens valg)*: samme `<origin>.<navn>` kan ha ulik type eller beskrivelse avhengig av elementet
(44 tilfeller i v2.0, f.eks. `Entity.id`). Input bruker feltet slik det står på `origin` selv (elementet eller
`structures[origin]`); finnes det ikke der, den vanligste varianten, og ved likt antall den fra elementet som kommer først
alfabetisk. Forklaringen skal være generell nok til å gjelde alle variantene.

- **Type-kall** (element eller abstrakt type). Input:
  - navn, del og modul (hvis element), XSD-beskrivelse
  - arvekjede (navn)
  - egne felter: navn, attributt/element, type, kardinalitet, påkrevd, XSD-beskrivelse, og for enum-felter enum-navnet
  - for abstrakte hoder: konkrete medlemmer fra `substitutions` (maks 20 navn)
  - hvor typen brukes: inntil 10 elementer som har et felt med `refTarget`/`type` lik typen

  Output (strukturert JSON via `responseSchema`): `{ type: string | null, fields: { [feltnavn]: string } }`.
  `type` er forklaringen av selve typen (null for abstrakte typer som ikke er elementer).
- **Enum-kall.** Input: navn, XSD-beskrivelse, verdier med beskrivelser, inntil 10 felter som bruker enumen.
  Output: `{ enum: string }`.

Lengde: type 3–5 setninger, felt 1–2 setninger, enum 2–4 setninger. NeTEx-navn (elementer, felter, verdier) skrives som de er,
uten oversettelse. Ren tekst, ingen markdown.

### Modell og innlogging

- `@google/genai` (devDependency) med `vertexai: true`, prosjekt og region fra miljøvariabler (`GOOGLE_CLOUD_PROJECT`,
  `GOOGLE_CLOUD_LOCATION`), innlogging via Application Default Credentials.
- Modell fra `GEMINI_MODEL`. Standard er `gemini-3.7-flash`, godkjent i KI-registeret for Vertex AI og samme modell som
  `entur/ai-registry` bruker. Lokasjon fra `GOOGLE_CLOUD_LOCATION`, standard `eu` (EU-multiregionen, Enturs valg i
  `entur/ai-registry`). Begge bekreftes i prøvekjøringen før full kjøring
  *(byggerens valg)*. Temperatur lav (0.2).
- Lokalt: `gcloud auth application-default login`. I CI: GitHub-miljøet `prd` og `entur/gha-meta`-handlingen `cloud-auth`
  (Workload Identity Federation satt opp av Enturs selvbetjening).

### Hurtigbuffer og filer

- **Hurtigbuffer** `data/explanations-cache.json` (committes, publiseres ikke): nøkkel er SHA-256 av
  `PROMPT_VERSION + modell + kanonisk JSON av typens egen definisjon` (navn, beskrivelse, arvekjede, egne felter, medlemmer;
  for enum: navn, beskrivelse, verdier). Listene over hvor typen brukes sendes med som kontekst, men er ikke med i nøkkelen,
  så et nytt element som peker på `Line` lager ikke `Line` på nytt *(byggerens valg)*. Verdi er modellens output og tidspunkt. Like typer i flere versjoner gir
  samme nøkkel og kalles bare én gang. Endres prompten, økes `PROMPT_VERSION` og alt lages på nytt.
- **Per versjon** `public/data/explanations-<versjon>.json`, bygget fra hurtigbufferen:
  ```json
  {
    "version": "v2.0",
    "model": "gemini-3.7-flash",
    "generatedAt": "…",
    "types":  { "Line": "…" },
    "fields": { "Line.TransportMode": "…" },
    "enums":  { "AllVehicleModesOfTransportEnumeration": "…" }
  }
  ```
  Feltnøkkel er `<origin>.<feltnavn>`, slik at arvede felter deler forklaring med typen de er definert på.
- Oppføringer som ikke lenger finnes i noen versjon fjernes fra hurtigbufferen.

### Skript

`npm run explain` → `scripts/explain.js`:

1. Leser alle `public/data/netex-*.json` fra `versions.json`.
2. Bygger kall-input for hver type og enum, regner ut nøkkel, slår opp i hurtigbufferen.
3. Sender manglende kall til Gemini med begrenset samtidighet (4) og nye forsøk med pause ved 429/5xx (maks 3).
4. `MAX_REQUESTS` (standard 2000) setter et tak per kjøring, så en feil i nøkkelen ikke gir en stor regning.
   Det som ikke rakk å bli laget, tas neste natt.
5. Lagrer hurtigbufferen underveis (så et avbrudd ikke kaster arbeid), og skriver til slutt alle `explanations-<versjon>.json`.
6. Validerer output: forklaringer for felter som ikke finnes i input forkastes; tom eller manglende tekst lagres ikke.

Ren logikk (bygge input, nøkkel, bygge versjonsfil, validering) ligger i egne moduler med enhetstester; Gemini-klienten sendes
inn slik at testene kan bruke en falsk klient.

### CI

`update-data.yml` committer XSD-data til `main` som i dag. En ny jobb `explain` kjører etter `update` (også når ingen data
ble endret, så forklaringer som manglet eller ikke rakk å bli laget, tas igjen):

- Kjøres bare når repo-variabelen `EXPLAIN_ENABLED` er `true` (av/på-bryter for modellkallene) og bare fra `main`.
  Kjører i GitHub-miljøet `prd`. Rettigheter: `contents: write`, `pull-requests: write`, `id-token: write`.
- Sjekker ut `main`, logger inn med `cloud-auth` som prd-tjenestekontoen, kjører `npm run explain` mot `ent-netex-prd`.
- Endringer i `data/explanations-cache.json` og `public/data/explanations-*.json` legges i en PR fra den faste branchen
  `ki-forklaringer` mot `main` (`peter-evans/create-pull-request`). Branchen lages på nytt fra `main` hver natt, så PR-en
  oppdateres i stedet for at det blir flere, og den får aldri konflikter. Ingen endringer → ingen PR (en åpen PR lukkes).
- PR-beskrivelsen viser modell, antall nye, endrede og fjernede forklaringer, og et utvalg nye tekster å se på først.
  Den første PR-en blir stor (rundt 6000 tekster); der er gjennomgangen stikkprøver.
- Når PR-en merges, publiserer `deploy-pages.yml` som ved alle push til `main`.
- Feiler genereringen, feiler bare `explain`-jobben; XSD-data er allerede committet og publisert.
- Første fulle kjøring startes med `workflow_dispatch`.

GCP-oppsett (samme mønster som `entur/ai-registry`; README beskriver stegene):

- Enturs selvbetjening (eneste godkjente vei): `.entur/cicd.yaml` (`GitHubActions`, miljø `prd`) og `.entur/netex.yaml`
  (`GoogleCloudApplication`, id `netex`, eier `team-produkt`, bare `prd`, uten Kubernetes). Gir prosjektet `ent-netex-prd`,
  tilstandsbøtta `ent-gcs-tfa-netex` og GitHub-miljøet `prd` med Workload Identity. Lagt til i en egen PR som apply-es først.
- `terraform/` aktiverer `aiplatform.googleapis.com` og gir prd-miljøets GitHub-tjenestekonto `roles/aiplatform.user`.
  `terraform-apply.yml` kjører ved merge til `main`; `terraform-plan.yml` kjøres manuelt.
- Budsjettvarsel på prosjektet.
- Repo-innstilling: «Allow GitHub Actions to create and approve pull requests» må være på.
- Registrering av bruken i KI-løypa (<https://ki.entur.no/ki-loypa>).

### Appen

- `fetchExplanations(version)` henter `explanations-<versjon>.json`. 404 eller feil gir `null` uten feilmelding. Hentes parallelt
  med versjonsdataene og blokkerer ikke visningen.
- Komponent `AiExplanation` viser teksten i en dempet boks med etiketten «Forklaring (KI-generert)» og en kort merknad om at den
  kan inneholde feil, og at XSD-beskrivelsen er den offisielle. Vises:
  - på elementsiden, under XSD-beskrivelsen
  - i feltdetaljen (`FieldDetail`), under XSD-beskrivelsen, med nøkkel `<origin>.<navn>`
  - på enum-siden, under XSD-beskrivelsen
- Ingen boks når forklaringen mangler.
- Stil med Linje-tokens, fungerer i mørk modus.

### Testing

- Enhetstester for input-bygging, nøkkel, validering og versjonsfil, med fast testdata.
- Test av skriptets løkke med falsk Gemini-klient: hurtigbuffer brukes, tak respekteres, feil stopper ikke resten.
- Komponenttester: boks vises med tekst, vises ikke uten; appen virker når forklaringsfilen mangler.
- Manuell kjøring mot Vertex AI for et lite utvalg (`MAX_REQUESTS=20`) for å vurdere språk og kvalitet før full kjøring.

## Overlatt til byggeren

- Nøyaktig prompttekst, så lenge den følger reglene over.
- Utseendet på boksen innenfor Linje.
- Navn på moduler og funksjoner.
