# Entur Linje og strukturvisning – implementasjonsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Riktige NeTEx-data fra XSD-en (arv, felter, enums, listeinnhold) og en ny elementvisning (Felter + Struktur) bygd på Entur Linje, med Uniformen som skall.

**Architecture:**
- **Parser.** Skriptene i `scripts/` leser XSD-en med bevart rekkefølge til en mellomrepresentasjon (partikler: element/group/sequence/choice). En resolver flater dette ut til ferdige `Element`-, `Field`-, `EnumType`- og `structures`-data per versjon.
- **Data.** Resultatet skrives til `public/data/` og lastes med `fetch` i appen.
- **App.** Et React-skall bruker `@entur/*`-komponenter og CSS-filer med tokens. Ren logikk (filtrering, tre, søk, URL) ligger i `src/model/` og testes uten DOM. Uniformen legges inn i `index.html` av et Vite-tillegg når appen bygges.

**Tech Stack:** Vite 6, React 19, TypeScript 5.7, Vitest 3 + Testing Library, fast-xml-parser 5 (`preserveOrder`), `@entur/*` siste versjon.

**Spec:** `docs/superpowers/specs/2026-11-18-linje-strukturvisning-design.md`

## Global Constraints

- **Ingen hardkodede farger** i komponenter eller CSS:
  - farger: `--basecolors-*` (fra `@entur/tokens/dist/base.css`, følger `data-color-mode`)
  - typemerker: datatokens `--standard-*` (fra `data.css`)
  - avstand: `--space-*`
  - Hex-verdier er bare tillatt i testfiler.
- **CSS-rekkefølge i `src/styles/global.css`:**
  1. `@entur/tokens/dist/base.css`
  2. `@entur/tokens/dist/styles.css`
  3. komponentstilene i rekkefølgen fra Linje sin getting-started: a11y, icons, tab, typography, layout, loader, expand, button, alert, menu, modal, tooltip, form, chip, table, dropdown
- **Ikke vis noe XSD-en ikke sier:**
  - en ref/list/complex som ikke kan løses opp, vises som ukjent (uten lenke)
  - det skal aldri gjettes på navn uten å sjekke at målet finnes
- **Ingen rammeverksklasser filtreres bort** fra arvekjeden.
- **All lenking og datahenting går via `import.meta.env.BASE_URL`.** Vite `base` hentes fra `process.env.BASE_PATH ?? '/'`.
- **Uniformen:**
  - `https://uniformen.entur.no/ssr?simple=true&locale=nb-NO`
  - tidsavbrudd 2000 ms
  - ingen `X-Uniformen-Consumer`, ingen `app`-parameter
  - feiler kallet, bygges appen uten skall
- **Språk i brukergrensesnittet:** norsk bokmål. `<html lang="nb">`.
- **Commits:** én per oppgave, med meldingsprefiks `feat:`, `fix:`, `refactor:` eller `chore:`. Hver melding avsluttes med `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Rekursive strukturer.** For eksempel kan `Quay` inneholde `quays`. Folder man ut et element som allerede finnes lenger opp i samme gren, skal det vises som en lenke, ikke folde seg ut i det uendelige. *(Test i oppgave 9.)*
2. **Element mangler etter versjonsbytte.** Valgt element finnes ikke i den nye versjonen. Da skal det vises «Finnes ikke i vX», og navigasjonen skal fortsatt virke. *(Test i oppgave 7.)*
3. **Ukjent element i URL-en.** `?element=Finnesikke` skal gi en tydelig melding, ikke en tom side eller en krasj. *(Test i oppgave 7.)*
4. **Enum uten verdier.** Når typen ikke finnes i `enums`, skal raden vise «Ingen verdier funnet i XSD-en» og ikke krasje. *(Test i oppgave 8.)*
5. **Uniformen nede eller treg ved bygg.** Bygget skal fullføre uten skall og skrive en advarsel til konsollen. *(Test i oppgave 6.)*

---

## Filstruktur

| Fil | Ansvar |
|---|---|
| `scripts/parser/xsd-parser.js` | **Skrives om.** Én XSD-fil → elementer, typer, grupper, enums og listetyper, med bevart rekkefølge. |
| `scripts/parser/model-resolver.js` | **Ny**, erstatter `hierarchy-resolver.js`. Slår sammen kontekst → `Element[]`, `structures`. |
| `scripts/parser/naming.js` | **Ny.** `displayName(typeName)`, `moduleFromPath(path)` og `humanizeModule(module)`. |
| `scripts/fetch-and-parse.js` | **Endres.** Leser alle mapper, tar med elementer fra rammeverket, skriver til `public/data/` og tar valgfritt versjonsargument. |
| `scripts/parser/__tests__/*.test.js` | Tester for parseren, med XSD-fikstur-filer som strenger direkte i testen. |
| `scripts/__tests__/data-v2.0.test.js` | Kontrolltest mot den genererte `public/data/netex-v2.0.json`. |
| `public/data/versions.json`, `public/data/netex-<v>.json` | Genererte data som committes. |
| `vite/uniformen-plugin.ts` | Vite-tillegg som legger inn Uniformen ved bygg. |
| `src/types.ts` | **Skrives om** til modellen fra spec §1. |
| `src/data/loadVersion.ts` | `fetchManifest()` og `fetchVersion()`. |
| `src/model/urlState.ts` | Leser og skriver URL-tilstand. |
| `src/model/fieldFilters.ts` | Filterchips: telling og filtrering. |
| `src/model/structureTree.ts` | Barn til en node i strukturtreet. |
| `src/model/search.ts` | Søk i elementer, felter og enums. |
| `src/model/navigation.ts` | Gruppering etter del og modul. |
| `src/components/…` | `AppLayout`, `Sidebar`, `Toolbar`, `ElementPage`, `AncestorPills`, `FieldsTab`, `StructureTab`, `FieldDetail`, `EnumPage`, `KindBadge`, `InstanceTab`, `ExampleLoader`. Hver har sin egen `.css`. |
| `src/styles/global.css` | Importrekkefølge, fonter og grunnoppsett. |

---

### Task 1: Fjern profiler

**Files:**
- Delete:
  - `src/components/ProfileStructureTree.tsx`
  - `src/components/ProfileGuidePanel.tsx`
  - `scripts/fetch-profiles.js`
  - `scripts/parser/profile-xsd-parser.js`
  - `scripts/parser/__tests__/profile-xsd-parser.test.js`
  - `scripts/profiles/`
  - `src/data/profiles/`
  - `docs/uk-profile-implementation.md`
- Modify:
  - `src/App.tsx`, `src/components/ElementTree.tsx`, `src/components/AttributePanel.tsx`: fjern profil-props, profilmerker, profilkolonne og profilvelger.
  - `src/types.ts`: fjern `Profile*`, `ActiveProfile` og `StructureNode*`.
  - `package.json`: fjern skriptet `fetch-profiles`.
  - `.github/workflows/update-data.yml`: fjern profilsteget.
  - `README.md`: fjern omtalen av profiler.

**Interfaces:** Ingen nye.

- [ ] **Step 1:** Slett filene, og fjern profilbruk i de filene som skal endres.
- [ ] **Step 2:** `grep -rniE "profil|profile" src scripts .github README.md`. Forventet: ingen treff (unntatt ordet «profil» i ikke-relatert tekst, hvis det finnes).
- [ ] **Step 3:** `npm run build && npx vitest run`. Forventet: bygget går gjennom, og de gjenværende testene passerer.
- [ ] **Step 4:** Commit: `refactor: fjern profilsammenligning`.

---

### Task 2: XSD-parser med bevart rekkefølge

**Files:**
- Rewrite: `scripts/parser/xsd-parser.js`
- Test: `scripts/parser/__tests__/xsd-parser.test.js` (skrives om)

**Interfaces:**
- Produces:

```js
/** @typedef {{kind:'element', name:string, ref:boolean, type:string|null, minOccurs:string, maxOccurs:string, description:string}
 *          | {kind:'group', ref:string, minOccurs:string, maxOccurs:string}
 *          | {kind:'sequence'|'choice', minOccurs:string, maxOccurs:string, content:Particle[]}} Particle */
/** @typedef {{name:string, type:string, use:'required'|'optional', description:string}} AttrDef */
/** @typedef {{base:string|null, derivation:'extension'|'restriction'|null, content:Particle[], attributes:AttrDef[], abstract:boolean, description:string}} TypeDef */
export function parseXsd(xsdString, sourcePath = '') /* => {
  elements: Map<string,{abstract:boolean, substitutionGroup:string|null, type:string|null, inlineType:TypeDef|null, description:string, source:string}>,
  types: Map<string,TypeDef>,
  groups: Map<string,{content:Particle[]}>,
  enums: Map<string,{name:string, description:string, values:{value:string, description:string}[]}>,
  listTypes: Map<string,string>   // simpleType-navn → itemType
} */
```

- [ ] **Step 1: Skriv tester som feiler** (fikstur-XSD som strenger i testen):
  - `keeps sequence order across groups and inline elements`: en type med `<sequence><group ref="AGroup"/><element name="X"/><group ref="BGroup"/></sequence>`. Forventet `content.map(p => p.ref ?? p.name)` er `['AGroup','X','BGroup']`.
  - `parses choice with cardinality`: `<choice minOccurs="0" maxOccurs="unbounded"><element ref="QuayRef"/><element ref="Quay"/></choice>`. Forventet: én partikkel med `kind:'choice'`, `minOccurs:'0'`, `maxOccurs:'unbounded'` og to elementer med `ref:true`.
  - `parses group-level minOccurs`: `<group ref="EntityInVersionGroup" minOccurs="0"/>`. Forventet `minOccurs:'0'`.
  - `parses attributes with use`: `<attribute name="id" type="StopPlaceIdType" use="required"/>`. Forventet `{name:'id', type:'StopPlaceIdType', use:'required'}`. Uten `use` er det `'optional'`.
  - `parses inline element type as restriction`: et `xsd:element` med `complexType/complexContent/restriction base="StopPlace_VersionStructure"`. Forventet `inlineType.base === 'StopPlace_VersionStructure'` og `derivation === 'restriction'`.
  - `parses enums with value descriptions`: et enum-`simpleType` med annotasjon og verdier, der én verdi har dokumentasjon. Forventet `values[0]` er `{value:'all', description:'If all modes are meant.'}`, og verdier uten dokumentasjon får `''`.
  - `parses list simpleType`: `<simpleType name="AllPublicTransportModesListOfEnumerations"><list itemType="AllPublicTransportModesEnumeration"/></simpleType>`. Forventet: `listTypes` gir itemType.
  - `records source path on elements`: `parseXsd(xsd, 'xsd/a/netex_b_c_version.xsd')`. Forventet `elements.get(n).source` er den samme stien.
- [ ] **Step 2:** `npx vitest run scripts/parser/__tests__/xsd-parser.test.js`. Forventet: FAIL.
- [ ] **Step 3: Implementer `parseXsd`.** Bruk `XMLParser` med `preserveOrder: true`, `ignoreAttributes: false` og `attributeNamePrefix: '@_'`. Lag én rekursiv `readParticles(nodes)` for `sequence`, `choice`, `group` og `element`. Standardverdi for `minOccurs`/`maxOccurs` er `'1'`. Dokumentasjon hentes fra `annotation/documentation`, og blir `''` hvis den ikke finnes.
- [ ] **Step 4:** Kjør testene. Forventet: PASS.
- [ ] **Step 5:** Commit: `feat(parser): les XSD med bevart rekkefølge, choice, attributter og enum-beskrivelser`.

---

### Task 3: Resolver – arvekjede, felter, opprinnelse, påkrevd og choice

**Files:**
- Create: `scripts/parser/model-resolver.js`, `scripts/parser/naming.js`
- Delete: `scripts/parser/hierarchy-resolver.js` og testen til den
- Test: `scripts/parser/__tests__/model-resolver.test.js`, `scripts/parser/__tests__/naming.test.js`

**Interfaces:**
- Consumes: resultatet fra `parseXsd`, slått sammen til én kontekst `{elements, types, groups, enums, listTypes}` (samme Map-former som i Task 2).
- Produces:

```js
export function displayName(typeName) // 'StopPlace_VersionStructure'→'StopPlace', 'EntityStructure'→'Entity', 'DataManagedObjectStructure'→'DataManagedObject', 'Quay_VersionedChildStructure'→'Quay'
export function resolveElement(name, ctx) /* => { ancestors:{name:string, abstract:boolean}[], fields: Field[] } */
// Field = { name, type, kind, isAttribute, isList, minOccurs, maxOccurs, required, choice?, origin, description, contains?, refTarget?, structure? }
// (kind, isList, contains, refTarget, structure fylles i Task 4. I denne oppgaven er kind foreløpig 'string' og isList false.)
```

**Regler (fra spec §1):**
- **Effektiv type:** `inlineType`, deretter den navngitte typen `ctx.types.get(el.type)`, deretter `${name}_VersionStructure` hvis den finnes.
- **Arvekjede:** gå `base` oppover fra den effektive typen. `ancestors` er alle typer i kjeden over elementets egen klasse, sortert fra roten og med `displayName`. `abstract` er `true` når et element med det navnet er abstrakt (eller navnet med `_Dummy`), eller når typen er abstrakt.
- **Felter:**
  - `extension` = basens felter + egne partikler.
  - `restriction` = bare egne partikler. Da er grupper og elementer som ikke er listet, ikke tillatt.
  - Attributter: basens attributter slås sammen med egne, og egne vinner på navn.
  - Attributtene kommer først i `fields`, med `isAttribute: true`.
- **Opprinnelse (`origin`):**
  - Gå kjeden fra roten og nedover, og registrer hvilken type som først legger til hver `group ref`.
  - Felter fra en gruppe får `displayName` av den typen.
  - Elementer som står direkte i en type, får den typens `displayName`. For en innebygd type er det elementnavnet.
- **`required`:** `minOccurs ≥ 1` på feltet **og** på alle omsluttende grupper og sekvenser **og** ingen omsluttende `choice` med `minOccurs 0`. Attributter: `use === 'required'`.
- **`choice`:** hver `choice`-partikkel får `id = \`${origin}#${løpenummer}\`` og egen `minOccurs`/`maxOccurs`. Feltene inni bærer den innerste choice-en.

- [ ] **Step 1: Skriv tester som feiler:**
  - **naming:** de fire `displayName`-eksemplene over.
  - **`ancestors from root, nothing filtered`:** kjeden er `Entity ← EntityInVersion ← DataManagedObject ← GroupOfEntities ← Site ← StopPlace`, satt opp med `*_VersionStructure`/`*Structure` og extensions. Forventet `ancestors.map(a=>a.name)` er `['Entity','EntityInVersion','DataManagedObject','GroupOfEntities','Site']`.
  - **`restriction override wins for attributes`:** `EntityStructure` har `id` optional, og StopPlace sin inline restriction har `id` required med typen `StopPlaceIdType`. Forventet: feltet `id` har `required:true`, `type:'StopPlaceIdType'` og `isAttribute:true`, og står først i `fields`.
  - **`restriction omits unlisted groups`:** basen har grupper A og B, og den innebygde restriction-en lister bare A. Forventet: ingen felter fra B.
  - **`origin is the type that introduced the group`:** `Name` i `GroupOfEntitiesGroup` gir `origin:'GroupOfEntities'`, også når en restriction lenger ned lister gruppen på nytt.
  - **`order is root first`:** felter fra `EntityInVersion` kommer før felter fra `Site`, som kommer før StopPlace sine egne.
  - **`required respects group minOccurs`:** et felt med `minOccurs 1` inni `group minOccurs="0"` gir `required:false`.
  - **`choice members share id`:** to elementer i samme choice får lik `choice.id`. Et felt utenfor har ikke `choice`.
- [ ] **Step 2:** Kjør testene. Forventet: FAIL.
- [ ] **Step 3:** Implementer `naming.js` og `resolveElement` etter reglene over. Bruk en sykel-vakt (`Set`) på typekjeden og på gruppene.
- [ ] **Step 4:** Kjør testene. Forventet: PASS.
- [ ] **Step 5:** Commit: `feat(parser): riktig arvekjede, feltopprinnelse, påkrevd og choice`.

---

### Task 4: Resolver – typer, enums, listeinnhold, strukturer, ref-mål og modul

**Files:**
- Modify: `scripts/parser/model-resolver.js`, `scripts/parser/naming.js`
- Test: de samme testfilene som i Task 3

**Interfaces:**
- Produces:

```js
export function resolveModel(ctx, partMap /* Map<elementName, 0|1|2|3> */) /* => {
  elements: Element[],                      // ikke-abstrakte, sortert på navn
  enums: Record<string, EnumType>,
  structures: Record<string, Field[]> } */
// Element = { name, abstract:false, part, module, description, ancestors, fields }
export function moduleFromPath(path)    // 'xsd/netex_part_1/part1_ifopt/netex_ifopt_stopPlace_version.xsd' → 'stopPlace'
export function humanizeModule(module)  // 'stopPlace' → 'Stop place', 'fareProduct' → 'Fare product'
```

**Regler for `kind`, i prioritert rekkefølge:**
1. Typen finnes i `enums` → `'enum'`.
2. Typen finnes i `listTypes` og itemType finnes i `enums` → `'enum'` med `isList: true`, og `type` settes til itemType.
3. Navnet slutter på `Ref`/`Refs`, eller typen slutter på `RefStructure` → `'ref'`.
4. Typen slutter på `_RelStructure` → `'list'`.
5. Typen er en `complexType` i `ctx.types` → `'complex'`.
6. `xsd:boolean` / `xsd:integer` / `xsd:decimal` → tilsvarende kind. Alt annet → `'string'`.

**Utfylling:**
- **`refTarget`:** typen eller navnet med `Ref`/`Refs`/`RefStructure` fjernet. Settes bare hvis det finnes et element med det navnet.
- **`contains`** (for `list`): elementpartiklene i RelStructure-typen, både direkte og i `choice`, som `{name, minOccurs, maxOccurs}`. Kardinaliteten arves fra den omsluttende choice-en. `*Ref`-elementer tas med.
- **`structure`** (for `complex`): typenavnet. `structures[typenavn]` fylles med `resolveType(typenavn)`, som bruker samme flatingsregler som i Task 3, med `origin = displayName(typenavn)`. Gjøres for alle complex-typer som refereres, med sykel-vakt.

- [ ] **Step 1: Skriv tester som feiler:**
  - `enum kind`
  - `list of enum sets isList and itemType`
  - `RelStructure contains Quay and QuayRef`: fikstur som speiler `quays_RelStructure`. Forventet `contains.map(c=>c.name)` er `['QuayRef','Quay']` med `maxOccurs:'unbounded'`.
  - `ref without existing target has no refTarget`
  - `complex type fills structures`
  - `moduleFromPath`: to eksempler fra del 1 og del 3.
  - `humanizeModule`
  - `abstract elements are excluded from elements`
- [ ] **Step 2:** Kjør testene. Forventet: FAIL.
- [ ] **Step 3:** Implementer etter reglene.
- [ ] **Step 4:** Kjør testene. Forventet: PASS.
- [ ] **Step 5:** Commit: `feat(parser): enums, listeinnhold, strukturer og moduler`.

---

### Task 5: Henteskript, genererte data og CI

**Files:**
- Modify:
  - `scripts/fetch-and-parse.js`
  - `package.json`: skriptet `fetch-schema` beholdes. `node scripts/fetch-and-parse.js [versjon…]` begrenser hvilke versjoner som hentes.
  - `.github/workflows/update-data.yml`
  - `.gitignore`: fjern `src/data/versions/` og `versions-manifest.json`
- Delete: `src/data/netex-*.json`, `src/data/versions/`
- Create:
  - `public/data/versions.json`
  - `public/data/netex-<v>.json` for hver versjon
  - `scripts/__tests__/data-v2.0.test.js`

**Interfaces:**
- Produces:
  - `public/data/versions.json`: `{ generatedAt, versions:[{version, file, elementCount, enumCount, fetchedAt} | {version, error}] }`
  - `public/data/netex-<v>.json`: `VersionData` fra spec §1 (`{version, fetchedAt, elements, enums, structures, examples}`), minifisert.

**Endringer i skriptet:**
- Alle filer under `xsd/netex_framework/` leses rekursivt med `listXsdFilesDeep`. Elementer derfra får `part: 0`.
- Del 3 leses rekursivt fra `xsd/netex_part_3`.
- Enums og `listTypes` samles fra **alle** filer.
- Kilden sendes til `parseXsd(text, path)`.
- `resolveModel` erstatter `resolveHierarchy`.
- Henting av eksempler er uendret.

- [ ] **Step 1: Skriv kontrolltesten.** `scripts/__tests__/data-v2.0.test.js` leser `public/data/netex-v2.0.json` og sjekker:
  - StopPlace `ancestors.map(a=>a.name)` er `['Entity','EntityInVersion','DataManagedObject','GroupOfEntities','GroupOfPoints','Zone','Place','AddressablePlace','SiteElement','Site']`. Sammenlign med XSD-en på v2.0 hvis testen feiler, og rett eventuelt listen etter XSD-en, ikke etter koden.
  - StopPlace-feltet `id` har `isAttribute && required`.
  - StopPlace-feltet `Name` har `origin === 'GroupOfEntities'`.
  - StopPlace-feltet `quays` har `contains` med `Quay`.
  - `enums.StopTypeEnumeration.values` inneholder `railStation`.
  - StopPlace-feltet `OtherTransportModes` har `kind==='enum' && isList`.
  - `elements.some(e => e.name === 'Operator' && e.part === 0)`.
- [ ] **Step 2:** Kjør testen. Forventet: FAIL (fila finnes ikke).
- [ ] **Step 3:** Oppdater skriptet. Kjør `npm run fetch-schema -- v2.0`, og deretter `npm run fetch-schema` for alle versjoner. Kjør det i bakgrunnen, fordi det kan ta flere minutter.
- [ ] **Step 4:** Kjør testen. Forventet: PASS.
- [ ] **Step 5:** Workflow: fjern profilsteget, og bytt `git add` til `git add public/data`.
- [ ] **Step 6:** Commit: `feat(data): komplette NeTEx-data i public/data`.

---

### Task 6: Linje-oppgradering, skall og Uniformen

**Files:**
- Modify:
  - `package.json`: oppgrader alle `@entur/*` til siste versjon. Legg til `@entur/layout`, `@entur/menu`, `@entur/icons`, `@entur/tooltip`, `@entur/a11y`, `@entur/loader`, `@entur/dropdown` og `@entur/alert`.
  - `vite.config.ts`: `base: process.env.BASE_PATH ?? '/'` og `plugins: [react(), uniformen()]`.
  - `index.html`: `lang="nb"`, tittel «NeTEx-utforsker», og et lite inline-skript som setter `data-color-mode` fra `matchMedia('(prefers-color-scheme: dark)')`. Skriptet lytter også på endringer.
  - `src/main.tsx`
- Create:
  - `vite/uniformen-plugin.ts`, `vite/__tests__/uniformen-plugin.test.ts`
  - `src/styles/global.css` (erstatter `src/index.css`)
  - `src/components/AppLayout.tsx` og `.css`

**Interfaces:**
- Produces:
  - `export function uniformen(opts?: { url?: string; timeoutMs?: number; fetchImpl?: typeof fetch }): Plugin`
  - `export function injectUniformen(html: string, layout: {headAssets:string, headerHtml:string, footerHtml:string, scripts:string} | null): string`
  - `AppLayout({ sidebar, toolbar, children })`: rendrer `SkipToContent`, et rutenett med `<aside>` til venstre og `<main id="main-content">` til høyre, og verktøylinjen over innholdet.

- [ ] **Step 1: Skriv tester som feiler:**
  - `injects four parts in place`: HTML med `<head></head><body><div id="root"></div></body>`. `headAssets` skal ligge før `</head>`, `headerHtml` rett før `<div id="root">`, `footerHtml` rett etter `#root` sin `</div>`, og `scripts` rett før `</body>`.
  - `returns html unchanged when layout is null`
  - `plugin resolves to null on timeout`: `fetchImpl` som aldri svarer og `timeoutMs: 10`. `transformIndexHtml` skal returnere den opprinnelige HTML-en og kalle `console.warn` én gang.
- [ ] **Step 2:** Kjør testene. Forventet: FAIL.
- [ ] **Step 3:** Implementer tillegget. Henting skjer med `AbortController`. Svaret caches per prosess, slik at dev-serveren ikke henter på nytt for hver forespørsel.
- [ ] **Step 4:** Oppgrader pakkene, og skriv `global.css` med importrekkefølgen fra Global Constraints og tokens for `body`. Gå gjennom migreringsguiden (URL i spec §2):
  - `TertiaryButton` → `SecondaryButton size="small"`
  - `Modal` krever `size`
  - `Table compact` → `spacing="middle"`
  - Nationale-fonten tas inn slik README-en til `@entur/typography` beskriver, og `body` bruker fontfamilie-tokenet.
- [ ] **Step 5:** Kjør `npm run build`. Kjør deretter `grep -c uniformen-top-nav dist/index.html`. Forventet: minst 1 når nettet virker. Kjør så testene. Forventet: PASS.
- [ ] **Step 6:** Commit: `feat(ui): Linje-oppgradering, AppLayout og Uniformen ved bygg`.

---

### Task 7: Datalasting, URL-tilstand, sidepanel og søk

**Files:**
- Rewrite: `src/types.ts` (modellen fra spec §1, med `Field.isAttribute` i tillegg) og `src/App.tsx`
- Create:
  - `src/data/loadVersion.ts`
  - `src/model/urlState.ts`, `src/model/search.ts`, `src/model/navigation.ts`, med tester i `src/model/__tests__/`
  - `src/components/Sidebar.tsx` og `.css`, `src/components/Toolbar.tsx` og `.css`, `src/__tests__/App.test.tsx`
- Delete: `src/components/ElementTree.tsx`, `src/components/SearchBar.tsx`, `src/constants.ts`, og testen til `ElementTree.filtering`

**Interfaces:**
- Produces:

```ts
export async function fetchManifest(): Promise<VersionManifest>
export async function fetchVersion(version: string): Promise<VersionData>   // fetch(`${import.meta.env.BASE_URL}data/netex-${version}.json`)
export interface UrlState { v: string; element?: string; enum?: string; tab: 'felter' | 'struktur' | 'xml' }
export function readUrlState(search: string): UrlState                     // standard: v='v2.0', tab='felter'
export function toSearch(state: UrlState): string                          // utelater standardverdier
export function search(data: VersionData, q: string): { elements: Element[]; fields: { element: Element; field: Field }[]; enums: EnumType[] }  // case-insensitivt; tom q gir tomme lister; maks 50 per gruppe
export type PartFilter = 'alle' | 0 | 1 | 2 | 3
export function groupByModule(elements: Element[], part: PartFilter): { module: string; label: string; elements: Element[] }[]  // sortert på label
```

**Oppførsel:**
- `App` eier `UrlState`. Endringer i tilstanden skrives med `pushState`, og `popstate` leses.
- Ved bytte av versjon beholdes `element`/`enum`. Hvis navnet ikke finnes i den nye versjonen, vises `BannerAlertBox`: «{navn} finnes ikke i {v}».
- Ukjent element i URL-en gir samme melding.
- Hvis lasting av data feiler, vises `BannerAlertBox variant="negative"` med versjonen.
- Under lasting vises `Loader`.
- **Sidebar:** søkefelt (`TextField` med synlig label «Søk»), `SegmentedControl` for del (Alle / Rammeverk / Del 1 / Del 2 / Del 3), modulgrupper (`@entur/menu` sin SideNavigation, i beta-versjonen hvis den stabile er utfaset) og egen seksjon «Enums».
- **Søk:** når søket har treff, erstatter treffene listen og grupperes som Elementer / Felter / Enums.
- **Toolbar:** `Dropdown` «Versjon» og `ExampleLoader`.

- [ ] **Step 1: Skriv tester som feiler:**
  - `urlState`: rundtur `toSearch(readUrlState('?element=StopPlace&tab=struktur'))` gir `'?element=StopPlace&tab=struktur'`. Standardverdiene utelates.
  - `search`: «railstation» finner `StopTypeEnumeration`. «quays» finner feltet `quays` på StopPlace. Tom q gir tomme lister. Lag en liten `VersionData`-fikstur i `src/model/__tests__/fixture.ts` som de andre oppgavene kan gjenbruke.
  - `groupByModule`: `part:1` gir bare elementer fra del 1, gruppert og sortert.
  - **App** (med `fetch` mocket til fiksturen):
    - `?element=Finnesikke` viser «Finnesikke finnes ikke i v2.0».
    - Et versjonsbytte der elementet mangler, viser meldingen, og sidepanelet er fortsatt der.
- [ ] **Step 2:** Kjør testene. Forventet: FAIL.
- [ ] **Step 3:** Implementer. Inntil oppgave 8–10 er ferdige, viser `App` en midlertidig `<ElementPage>`-stub med elementnavnet.
- [ ] **Step 4:** Kjør testene, `npm run build` og `npm run lint`. Forventet: PASS.
- [ ] **Step 5:** Commit: `feat(ui): datalasting, URL-tilstand, sidepanel og søk`.

---

### Task 8: Elementside og fanen Felter (A)

**Files:**
- Create:
  - `src/components/ElementPage.tsx` og `.css`
  - `src/components/AncestorPills.tsx`
  - `src/components/FieldsTab.tsx` og `.css`
  - `src/components/KindBadge.tsx` og `.css`
  - `src/model/fieldFilters.ts`
  - tester i `src/model/__tests__/` og `src/components/__tests__/`
- Delete: `src/components/AttributePanel.tsx` og testen til den

**Interfaces:**
- Consumes: `Element`, `Field`, `EnumType` og `VersionData` fra `src/types.ts`, og fiksturen fra oppgave 7.
- Produces:

```ts
export type FieldFilter = 'alle' | 'egne' | 'arvet' | 'pakrevd' | 'enums'
export function filterFields(el: Element, f: FieldFilter): Field[]          // egne: origin === el.name; arvet: origin !== el.name
export function countFields(el: Element): Record<FieldFilter, number>
ElementPage({ element, data, tab, onTab, onNavigate })   // onNavigate({element}|{enum})
KindBadge({ field })                                     // tekst: kind, «liste av enum» når isList, «@attr» når isAttribute
```

**Oppførsel:**
- **Topp:**
  - `Heading1` med navn
  - `Tag` for del og modul
  - beskrivelse
  - `AncestorPills`: pillene er knapper fra roten til elementet. Det siste leddet er elementet selv, uthevet. Abstrakte piller er dempet og filtrerer tabellen på `origin`. Piller for konkrete elementer navigerer.
- **Faner** (`@entur/tab`): Felter / Struktur / XML-instans. XML-instans er deaktivert til en fil er lastet inn.
- **Felter-tabellen:**
  - Kolonner: Felt · Type · Antall · Fra.
  - Påkrevd vises som en markør med `VisuallyHidden`-teksten «påkrevd».
  - Choice vises som `Tag` «én av» med `Tooltip` som lister de andre alternativene.
  - Ref, list og complex med mål vises som lenker (`onNavigate`). Uten mål vises de som vanlig tekst.
  - Enum-rader bruker `ExpandableRow`. Utfoldet viser de alle verdiene med beskrivelse. Hvis typen mangler i `enums`, vises «Ingen verdier funnet i XSD-en».
- **Filterchips:** `FilterChip` med antall.
- **Farger på `KindBadge`:** enum → `--standard-coral`, ref → `--standard-jungle`, list → `--standard-azure`, complex → `--standard-lilac`, resten → `--basecolors-text-subdued`. Kantlinje eller tekst i farge, ikke helfylt bakgrunn, slik at kontrasten holder WCAG AA.

- [ ] **Step 1: Skriv tester som feiler:**
  - `countFields` på fiksturen gir forventede tall.
  - `filterFields('pakrevd')` gir bare felter med `required`.
  - **FieldsTab:** klikk på chipen «Enums» viser bare enum-rader. Utfolding av en enum-rad viser verdien `railStation` og beskrivelsen. En enum-type som mangler i `enums` gir «Ingen verdier funnet i XSD-en».
  - **AncestorPills:** klikk på en abstrakt pille filtrerer, slik at bare felter fra den klassen vises.
- [ ] **Step 2:** Kjør testene. Forventet: FAIL.
- [ ] **Step 3:** Implementer.
- [ ] **Step 4:** Kjør testene, `npm run build` og `npm run lint`. Forventet: PASS.
- [ ] **Step 5:** Commit: `feat(ui): elementside med felttabell, arvepiller og enum-verdier`.

---

### Task 9: Fanen Struktur (C)

**Files:**
- Create:
  - `src/model/structureTree.ts`
  - `src/components/StructureTab.tsx` og `.css`
  - `src/components/FieldDetail.tsx` og `.css`
  - tester

**Interfaces:**
- Produces:

```ts
export type TreeNode =
  | { kind: 'divider'; origin: string }
  | { kind: 'field'; id: string; field: Field; expandable: boolean }
  | { kind: 'choice'; id: string; minOccurs: string; maxOccurs: string; children: TreeNode[] }
  | { kind: 'element'; id: string; name: string; minOccurs: string; maxOccurs: string; expandable: boolean; cycle: boolean }
export function rootNodes(el: Element): TreeNode[]   // felter i rekkefølge; divider når origin skifter; felter med samme choice.id samles i én choice-node
export function childNodes(node: TreeNode, data: VersionData, path: string[]): TreeNode[]
  // list → element-noder fra contains; complex → feltene i structures[structure] (med divider); element → rootNodes(element)
  // path = elementnavn fra roten til noden; et element som finnes i path får cycle:true og expandable:false
```

**Oppførsel:**
- Tre med `role="tree"` og `treeitem`, piltaster etter ARIA tree-mønsteret (opp/ned flytter, høyre folder ut, venstre folder inn).
- Barn lastes først når noden foldes ut.
- Noder med `cycle` vises som lenke til elementet.
- Valgt felt vises i `FieldDetail`: navn, type, kardinalitet, påkrevd, «én av», beskrivelse og enum-verdier (samme liste som i oppgave 8, trukket ut som en felles komponent).
- På brede skjermer står detaljkortet ved siden av treet, på smale skjermer under.

- [ ] **Step 1: Skriv tester som feiler:**
  - `rootNodes inserts divider on origin change`
  - `rootNodes groups choice members`
  - `childNodes of quays lists Quay and QuayRef`
  - `recursive element is marked cycle`: fiksturen har `Quay` med feltet `quays` som inneholder `Quay`. Med `path ['StopPlace','Quay']` skal barnet `Quay` ha `cycle:true` og `expandable:false`.
  - **StructureTab:** høyre piltast på `quays` folder ut. Klikk på `StopPlaceType` viser `FieldDetail` med `railStation`.
- [ ] **Step 2:** Kjør testene. Forventet: FAIL.
- [ ] **Step 3:** Implementer.
- [ ] **Step 4:** Kjør testene, `npm run build` og `npm run lint`. Forventet: PASS.
- [ ] **Step 5:** Commit: `feat(ui): strukturvisning som XML-tre`.

---

### Task 10: Enum-side, XML-instans, eksempler og opprydding

**Files:**
- Create: `src/components/EnumPage.tsx` og `.css`, `src/components/InstanceTab.tsx` (flyttet fra `AttributePanel`)
- Modify:
  - `src/components/ExampleLoader.tsx`: `OverflowMenu` eller `Popover` i stedet for egen meny, `SecondaryButton size="small"` og `Modal size="medium"`.
  - `README.md`: hvordan data hentes, versjonsargument, `BASE_PATH` og Uniformen.
- Delete: alt som ikke lenger brukes. Sjekk med `npx tsc -b` og `grep`.

**Interfaces:**
- Produces: `EnumPage({ enumType, data, onNavigate })` viser:
  - navn og beskrivelse
  - tabell med Verdi · Beskrivelse
  - «Brukes av»: liste med `element.feltnavn` som lenker, regnet ut fra `data.elements[].fields` der `kind==='enum' && type===enumType.name`

- [ ] **Step 1: Skriv tester som feiler:**
  - `EnumPage` viser alle verdiene og lenken «StopPlace.StopPlaceType» for fiksturen.
  - `InstanceTab` viser verdiene til en instans fra en lastet XML (gjenbruk `parseXmlInstance`).
- [ ] **Step 2:** Kjør testene. Forventet: FAIL.
- [ ] **Step 3:** Implementer, og rydd opp.
- [ ] **Step 4:** Kjør `npx vitest run && npm run build && npm run lint`. Forventet: alt PASS. Kjør `grep -rnE "#[0-9a-fA-F]{3,6}\b" src --include=*.css --include=*.tsx`. Forventet: ingen treff.
- [ ] **Step 5:** Commit: `feat(ui): enum-side, XML-instans og opprydding`.

---

### Task 11: Verifisering i nettleser

- [ ] **Step 1:** `npm run build && npx vite preview --port 4173`, og åpne i nettleserpanelet.
- [ ] **Step 2:** Sjekk og ta skjermbilde av:
  1. Uniformen-header og -footer vises.
  2. `?element=StopPlace`: arvepiller fra Entity til StopPlace. Filteret «Enums» virker, og `StopPlaceType` viser verdier.
  3. Fanen Struktur: `quays` → `Quay` folder ut. Å folde ut `Quay` → `quays` gir en lenke, ikke en ny utfolding.
  4. Versjonsbytte til v1.3 og tilbake.
  5. Mørk modus (`resize_window colorScheme: 'dark'`).
  6. Mobilbredde 375 px uten horisontal scroll.
- [ ] **Step 3:** `BASE_PATH=/netex-overview/ npm run build && npx vite preview --base /netex-overview/`. Sjekk at data lastes på understien.
- [ ] **Step 4:** Rett eventuelle funn, og commit `fix: …`.
