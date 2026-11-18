# Design: Entur Linje, riktige NeTEx-data og ny elementvisning

**Dato:** 2026-11-18
**Status:** Godkjent 2026-11-18
**Branch:** `feat/linje-strukturvisning`

## Hensikt

NeTEx-utforskeren skal gjøre det mulig å forstå hvordan en NeTEx-fil er bygd opp uten å lese XSD-en og flere hundre sider med dokumentasjon.

**Målgrupper:**
- Utviklere som lager NeTEx-eksport. De slår opp et element og trenger å se hvilke felter det har, hvor feltene kommer fra, kardinalitet og gyldige verdier.
- Fagfolk i kollektivselskaper som vil forstå strukturen i en fil: hva som ligger inni hva, og hvorfor.

Repoet skal flyttes til Entur-organisasjonen etter dette arbeidet, så appen skal se ut og oppføre seg som et Entur-verktøy.

Profilsammenligningen (nordisk/fransk/britisk) fjernes. Den var tekstbasert og utdatert, og ga lite nytte.

## Mål

1. **Riktige data.** Alle enums som brukes har verdier, og verdiene har beskrivelser. Arvekjeden er komplett. Lister vet hvilke elementer de kan inneholde.
2. **Elementvisning A + C** (valgt fra skisser):
   - **Felter** (A, hovedfane): én samlet tabell med alle felter, både egne og arvede. Kolonnen «Fra» viser klassen feltet kommer fra. Arvekjeden ligger øverst som klikkbare piller. Filterchips: Alle / Egne / Arvet / Påkrevd / Enums. En enum-rad kan foldes ut og viser verdiene med beskrivelse direkte i tabellen.
   - **Struktur** (C, egen fane): elementet vises som et tre i samme rekkefølge som i XML-filen. Stiplede skillelinjer viser hvor feltene fra hver forelderklasse begynner. Lister og komplekse typer kan foldes ut på stedet (quays → Quay → …). Når et felt er valgt, vises et detaljkort med type, kardinalitet, beskrivelse og enum-verdier.
3. **Entur Linje.** Siste versjon av `@entur/*`, tokens i stedet for hardkodede farger, Nationale-fonten, mørk modus som følger systeminnstillingen.
4. **Uniformen som skall.** Hentes når appen bygges og legges rett inn i `index.html`.
5. **Delbare lenker.** Valgt versjon, element og fane ligger i URL-en.
6. **Versjonsbytte som virker.** Både med `npm run dev` og i en bygget app.

## Ikke-mål

- Profiler i noen form.
- NeTEx del 5 (nye mobilitetsformer), SIRI, GML og WSDL.
- Innlogging, eller at appen kjører som en server.
- Validering av opplastede filer mot XSD.
- Endre funksjonaliteten for å laste inn eksempelfiler (XML-instans). Den får bare nytt utseende.

## Anti-mål (dette vil være feil selv om det «virker»)

- **Visningen må aldri vise noe annet enn det XSD-en sier.** Det gjelder arvekjede, felter, enum-verdier og innhold i lister. Hvis noe ikke kan løses opp sikkert, skal det vises som ukjent, ikke gjettes.
- **Felter som finnes i XSD-en skal ikke skjules** fordi de ligger i rammeverket. `Name` kommer fra `GroupOfEntities` og skal vises som det.
- **Ingen nye hardkodede farger.** Bruk Linje-tokens.

## Begrensninger

- Statisk app med Vite + React 19. Ingen server.
- Hostes på Vercel (`netex-overview.vercel.app`), som bygger ved hver push til `main`. Den nattlige data-commiten utløser derfor et nytt bygg, og dermed også en oppdatert Uniformen. `BASE_URL` er `/`. Når repoet flyttes til Entur, blir appen trolig hostet på GitHub Pages under en understi (`/<repo>/`). Derfor skal all lenking og datahenting gå via `import.meta.env.BASE_URL`, og Vite sin `base` skal kunne settes med miljøvariabelen `BASE_PATH` (standard `/`). Selve Pages-workflowen (bygg og deploy, også etter den nattlige data-commiten) lages ved flyttingen og er ikke en del av denne leveransen.
- Data hentes nattlig av GitHub Actions (`update-data.yml`) fra `NeTEx-CEN/NeTEx`.
- Uniformen `/ssr` har ikke CORS og kan ikke kalles fra nettleseren. Den kan kalles uten token. Adresse: `https://uniformen.entur.no/ssr`. Testet 2026-11-18: `?simple=true&locale=nb-NO` gir 200 med `headAssets`, `headerHtml`, `footerHtml`, `scripts` og `csp`, alt innebygd.
- Nationale-fonten er lisensiert bare for offisielle Entur-produkter. Det er greit, siden repoet skal flyttes til Entur.

## Valgte tilnærminger

| Beslutning | Vurderte alternativer | Valgt | Hvorfor |
|---|---|---|---|
| Rekkefølge | (1) Data først, så UI · (2) Bare UI nå · (3) Parse XSD i nettleseren | **1** (valgt av Sturle) | Visualiseringen er bare verdt noe hvis dataene er riktige. (3) er tung og treg, og den nattlige jobben gjør allerede jobben. |
| Elementvisning | A felttabell · B lag for lag · C XML-struktur | **A + C** (valgt av Sturle) | A gir raske oppslag for utviklere, C forklarer filstrukturen for fagfolk. Arvepillene i A dekker det B viser. |
| Skall | (1) Uniformen hentet ved bygg · (2) `create-entur-frontend` (TanStack Start) · (3) egen toppbar | **1** (valgt av Sturle) | Appen forblir statisk og får likevel felles Entur-header og -footer. (2) krever en server og gir mye omskriving. Må bekreftes med Team Portal (se Åpent). |

## Dagens feil i dataene (verifisert)

1. **Enums forkastes.** `buildElementsJson` samler bare `enums` fra del 2 og 3. Rammeverket og del 1 blir kastet. Bare 75 av 187 enum-typer som brukes har verdier, og blant de som mangler er `StopTypeEnumeration` og `AllPublicTransportModesEnumeration`.
2. **Beskrivelsen av hver enum-verdi blir ikke lest**, selv om den finnes i XSD-en (`xsd:enumeration/xsd:annotation/xsd:documentation`).
3. **Lister av enums blir til tekst.** `simpleType` med `xsd:list itemType="…Enumeration"` (for eksempel `AllPublicTransportModesListOfEnumerations`) får `kind: string`.
4. **Arvekjeden bygges fra feil kjede.** `inheritedFrom` kommer fra substitusjonsgruppene, og `SKIP_TYPES` filtrerer bort rammeverksklasser. For StopPlace vises 3 klasser, men feltene kommer fra 9.
5. **Elementer som står direkte i en type blir ikke lest.** `parseXsd` leser bare `xsd:group ref` på typer, ikke `xsd:element` direkte i `sequence`/`choice`. Derfor vet vi ikke at `quays_RelStructure` kan inneholde `Quay` og `QuayRef`.
6. **XML-attributter (`id`, `version`, `order` …) blir ikke lest.**
7. **Elementer i rammeverket blir ikke lest.** Det gjelder for eksempel `Organisation`, `Operator` og `DayType`. Rammeverket brukes bare som kilde til typer og grupper.
8. **Grupperingen er håndkodet.** Med listene `*_GROUP_NAMES` havner 303 av omtrent 400 elementer i «Other».
9. **Versjonsbytte er ødelagt.** `versions-manifest.json` blir aldri committet (den står i `.gitignore`, og jobben legger den ikke til). I tillegg henter appen data fra `/src/data/…`, som ikke finnes i en bygget app.

## Design

### 1. Data og parser (`scripts/`)

**Parser (`xsd-parser.js`):**
- Les enums fra alle filer, også rammeverket og del 1: `{ name, description, values: [{ value, description }] }`.
- Les `simpleType` med `xsd:list itemType=X` som «liste av enum X».
- Les `xsd:element` (både `name` og `ref`) direkte i `sequence`/`choice` på `complexType`, i XSD-rekkefølge. Grupper og elementer skal stå i samme rekkefølge som i filen.
- Les `xsd:attribute` på typer (navn, type, påkrevd/valgfri, beskrivelse).
- Les elementets egen innebygde type (`xsd:element/xsd:complexType/complexContent/restriction|extension`). *(Mitt valg.)* Den innebygde typen bestemmer hvilken base-type som gjelder, hvilke grupper som er tillatt, og hvilke attributter som overstyres (for eksempel er `id` påkrevd med typen `StopPlaceIdType` på StopPlace, men valgfri i `EntityStructure`). Typen skal ikke lenger gjettes ut fra endelser når elementet har en innebygd type.
- Ta vare på `xsd:choice` og kardinalitet satt på gruppe- og sekvensnivå, i riktig rekkefølge. *(Mitt valg.)* Om det gjøres med `preserveOrder` i fast-xml-parser eller på en annen måte, bestemmer den som bygger.
- Ta vare på hvilken fil og mappe hvert element kommer fra.

**Oppløsning (`hierarchy-resolver.js`):**
- Arvekjeden bygges fra **typekjeden** (`extensionBase`). Visningsnavnet er typenavnet uten endelsene `_VersionStructure`, `_VersionedChildStructure` osv. Kjeden lagres fra roten til elementet selv. Ingen klasser filtreres bort, og abstrakte klasser merkes.
- Felter som elementets egen restriction utelater, er ikke tillatt i XML og vises ikke. Overstyringer fra restriction (type, påkrevd, kardinalitet) vinner. *(Mitt valg. Dette er «det XSD-en sier».)*
- Hvert felt får `origin` (klassen i typekjeden som definerer gruppen eller attributtet) og står i XSD-rekkefølge: roten først, deretter nedover kjeden, akkurat som i XML-filen.
- Ny feltart `kind`: `attribute` for XML-attributter. `enum` får `list: true` når feltet er en liste av enum.
- For hvert felt av typen `list`/`complex` løses det opp hva det kan inneholde:
  - `*_RelStructure` blir listen av elementnavn den kan inneholde (fra punkt 5 over), med kardinalitet.
  - Navngitte `*Structure`-typer som ikke er elementer (for eksempel `PublicCodeStructure`) blir sine egne felter, lagret i et eget oppslagsverk `structures`.
  - Kan noe ikke løses opp, lagres det som ukjent. Det skal ikke gjettes på navn.
- `group` erstattes av `module`, som utledes fra XSD-filen (se Navigasjon). `part` beholdes: 0 = rammeverk, 1–3 = del.

**Henting (`fetch-and-parse.js`):**
- Ta med elementer fra rammeverket (`part: 0`).
- Del 3: les alle undermapper rekursivt, slik del 1 og 2 gjør. I dag leses bare tre mapper.
- Skriv data til `public/data/netex-<versjon>.json` og `public/data/versions.json`, uten innrykk (minifisert). Fjern `src/data/netex-*.json` og `src/data/versions/`.
- Ta bort `fetch-profiles` og steget for profiler i `update-data.yml`. Jobben skal committe hele `public/data/`.

**Format** (TypeScript-typer i `src/types.ts`, skisse):

```ts
type FieldKind = 'attribute' | 'enum' | 'ref' | 'list' | 'complex' | 'string' | 'boolean' | 'integer' | 'decimal'
interface Field {
  name: string; type: string; kind: FieldKind; isList?: boolean   // isList: liste av enum
  minOccurs: string; maxOccurs: string; description: string
  required: boolean              // effektivt påkrevd: feltet og alle omsluttende grupper/sekvenser har minOccurs ≥ 1, og feltet er ikke i en valgfri choice
  choice?: { id: string; minOccurs: string; maxOccurs: string }  // felter med samme id er alternativer («én av»)
  origin: string                 // klassen feltet er definert i
  contains?: { name: string; minOccurs: string; maxOccurs: string }[]  // for list
  refTarget?: string             // for ref, når den kan løses opp
  structure?: string             // for complex: nøkkel i structures
}
interface Element {
  name: string; abstract: boolean; part: 0|1|2|3; module: string; description: string
  ancestors: { name: string; abstract: boolean }[]  // fra roten til forelder
  fields: Field[]                // alle felter i XSD/XML-rekkefølge
}
interface EnumType { name: string; description: string; values: { value: string; description: string }[] }
interface VersionData { version: string; fetchedAt: string; elements: Element[]; enums: Record<string, EnumType>; structures: Record<string, Field[]>; examples: Example[] }
```

**Tester:** Små XSD-fikstur-filer for hvert punkt i «Dagens feil» 1–7. I tillegg en kontrolltest mot ekte v2.0-data: arvekjeden til StopPlace skal være lik den som leses manuelt fra XSD-en, sjekket som en eksplisitt liste og ikke et antall (inkludert `EntityStructure`, som bidrar med `id`). `id` skal være påkrevd på StopPlace, `StopTypeEnumeration` skal ha verdier, og `quays` skal inneholde `Quay`.

### 2. Appskall og Linje

- Oppgrader `@entur/*` til siste versjon og les migreringsguiden (https://raw.githubusercontent.com/entur/design-system/main/skills/entur-web-development/references/migration-guide.md). Ta i bruk `@entur/layout`, `@entur/menu`, `@entur/icons`, `@entur/tooltip`, `@entur/a11y` og `@entur/loader` der de passer.
- CSS-rekkefølge som Linje anbefaler: `tokens/base.css` → `tokens/styles.css` → komponentstiler. Stiler som i dag står rett i koden flyttes til CSS-filer per komponent og bruker semantiske tokens (`--fill-…`, `--text-…` osv.). Ingen hex-verdier.
- Nationale-fonten tas inn via `@entur/typography`.
- Mørk modus: sett `data-color-mode` på `<html>` ut fra `prefers-color-scheme`. Ingen bryter for å skifte i denne omgangen.
- `SkipToContent` og `<main id="main-content">`.
- **Uniformen:** et Vite-tillegg med `transformIndexHtml` henter `/ssr?simple=true&locale=nb-NO` ved bygg og ved oppstart av dev-serveren, Headeren `X-Uniformen-Consumer` sendes ikke før appen er registrert. Uten den teller tjenesten kallet som `none`.
  - `headAssets` legges i `<head>`, `headerHtml` før `#root`, `footerHtml` etter `#root`, og `scripts` sist i `<body>`.
  - Hvis henting feiler eller tar mer enn 2 sekunder, bygges appen uten skall. Det skal ikke stoppe byggingen.
  - Ingen `app`-parameter før appen er registrert i Uniformen.
  - Feltet `csp` fra Uniformen brukes ikke, fordi Vercel-oppsettet ikke har noen CSP i dag. Hvis hostingen hos Entur innfører CSP, skal kildene herfra legges til der.
- **Layout under headeren:** venstre sidepanel med navigasjon og høyre innholdsflate. Sidepanelet skal kunne kollapses med `data-uniformen-sidebar` hvis vi senere slår på `sidebar=true`. Det er ikke med nå.

### 3. Navigasjon (venstre panel)

- Søkefelt øverst. Det søker i elementnavn, feltnavn og enum-navn og -verdier. Treffene grupperes som Elementer / Felter / Enums.
- Velger for del: Alle / Rammeverk / Del 1 / Del 2 / Del 3. Den erstatter chipsene i toppbaren.
- Elementene grupperes etter **modul**, utledet fra XSD-filen (for eksempel `netex_ifopt_stopPlace_version.xsd` blir «Stop place»). Abstrakte klasser vises ikke i listen, men kan nås via arvekjeden.
- Enums har sin egen seksjon i navigasjonen og sin egen side: verdier med beskrivelse, og «Brukes av» (elementer og felter, som lenker).
- Versjonsvelger (`@entur/dropdown`) og «Last inn eksempel» ligger i en verktøylinje over innholdet, ikke i Uniformen-headeren.

### 4. Elementside

**Topp:** elementnavn, del og modul som tag, beskrivelse og arvekjeden som piller fra roten til elementet. Pillene for abstrakte klasser er dempet. Et klikk på en pille som er et element åpner det. Et klikk på en abstrakt klasse filtrerer feltene til den klassen.

**Fane «Felter» (A):**
- Tabell (`@entur/table`) med kolonnene Felt · Type · Antall · Fra.
- Typen vises som et merke med fast farge per art, hentet fra Linje sin datapalett (`--data-…`-tokens). Ref, list og complex har lenke til målet.
- Påkrevde felter (`required`) får tydelig markering. Felter i en `choice` får merket «én av» med de andre alternativene i tooltip. XML-attributter vises først med `@` foran.
- Enum-rader kan foldes ut og viser verdiene med beskrivelse (tooltip eller tekst som foldes ut). «Liste av» vises når feltet er en liste av enum.
- Filterchips: Alle / Egne / Arvet / Påkrevd / Enums. Hver chip viser antall.

**Fane «Struktur» (C):**
- Treet starter i elementet med attributtene på toppen, så alle felter i XML-rekkefølge. Stiplede skillelinjer med klassenavn viser hvor hver klasse i kjeden begynner.
- En `choice` vises som en egen node, «én av (min..max)», med alternativene under seg.
- `list` kan foldes ut til elementene den kan inneholde (for eksempel `quays` → `Quay` | `QuayRef`), og et utfoldet element kan foldes videre ut. `complex` kan foldes ut til feltene i strukturen. Hvis et element finnes lenger opp i samme gren, vises det som en lenke i stedet for å foldes ut, så treet ikke går i ring.
- Et valgt felt viser et detaljkort under eller ved siden av treet, avhengig av skjermbredde.
- Tastatur: piltaster flytter og folder ut/inn (tree-mønsteret fra ARIA).

**Fane «XML-instans»** (som i dag, bare med nytt utseende), aktiv når en fil er lastet inn.

### 5. URL og tilstand

- `?v=v2.0&element=StopPlace&tab=struktur`, eller `&enum=StopTypeEnumeration` for en enum-side. Tilstanden ligger i URL-en via `history.replaceState`/`pushState`. Ingen ruter-bibliotek.
- Versjonsdata lastes med `fetch(import.meta.env.BASE_URL + 'data/…')` og vises med en lasteindikator. Ved bytte av versjon beholdes valgt element hvis det finnes i den nye versjonen.

### 6. Fjernes

`ProfileStructureTree.tsx`, `ProfileGuidePanel.tsx`, `scripts/fetch-profiles.js`, `scripts/parser/profile-xsd-parser.js` (med test), `scripts/profiles/`, `src/data/profiles/`, profiltyper i `types.ts`, `docs/uk-profile-implementation.md`, profilsteget i CI, og profilomtalen i README.

## Opp til den som bygger

- Hvordan CSS-en organiseres (CSS-moduler eller vanlige filer per komponent), så lenge den bruker tokens.
- Nøyaktig hvilke Linje-komponenter som brukes for treet og sidepanelet. Det finnes ingen ferdig tre-komponent, så den lages selv.
- Hvordan modulnavn utledes fra filnavn.
- Ytelse: StopPlace har rundt 73 felter og treet kan bli dypt, men vanlig rendering bør holde. Ta i bruk virtualisering bare hvis det blir målbart tregt.

## Åpent

- **Bekreft med Team Portal (#work-micro-frontend)** at det er greit å hente Uniformen ved bygg og bruke den uten innlogging. Hvis ikke, går vi tilbake til egen toppbar (alternativ 3). Layouten gjør det enkelt å bytte.
- Registrere appen i Uniformen (`unlisted: true`) etter at repoet er flyttet til Entur.
