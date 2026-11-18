# KI-genererte forklaringer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Forhåndsgenererte norske KI-forklaringer av elementer, felter og enumer, laget i CI med Gemini i Vertex AI, gjennomgått i en PR og vist i appen ved siden av XSD-teksten.

**Architecture:** Et Node-skript (`npm run explain`) bygger én forespørsel per definerende type og per enum fra `public/data/netex-*.json`, slår opp i en hurtigbuffer (`data/explanations-cache.json`), sender det som mangler til Gemini, og skriver `public/data/explanations-<versjon>.json`. En egen CI-jobb kjører skriptet og legger endringene i en PR. Appen henter forklaringsfilen ved siden av versjonsdataene og gir den til komponentene via en React-kontekst.

**Tech Stack:** Node 24 (ESM, `.js` i `scripts/`), `@google/genai` (Vertex AI), Vitest, React 19 + TypeScript, Entur Linje, GitHub Actions (`google-github-actions/auth`, `peter-evans/create-pull-request`).

**Spec:** `docs/superpowers/specs/2026-11-18-ki-forklaringer-design.md`

## Global Constraints

- Forklaringene er på norsk bokmål; NeTEx-navn (elementer, felter, verdier) skrives uoversatt. Ren tekst, ingen markdown.
- Lengde: type 3–5 setninger, felt 1–2 setninger, enum 2–4 setninger.
- Modell fra `GEMINI_MODEL`, standard `gemini-3.5-flash-lite`; region fra `GOOGLE_CLOUD_LOCATION`, standard `europe-west1`; prosjekt fra `GOOGLE_CLOUD_PROJECT`. Temperatur 0.2.
- Samtidighet 4; maks 3 nye forsøk ved 429/5xx; `MAX_REQUESTS` standard 2000.
- Hurtigbuffernøkkel: SHA-256 av `PROMPT_VERSION + modell + kanonisk JSON av typens egen definisjon`. Bruksliste («brukes av») er ikke med i nøkkelen.
- Feltnøkkel i versjonsfilen: `<origin>.<feltnavn>`.
- Etikett i appen: «Forklaring (KI-generert)». XSD-beskrivelsen vises alltid, uendret.
- KI-tekst kommer aldri på `main` uten en PR som et menneske har merget.
- Ingen nøkler i repoet. CI bruker Workload Identity Federation.
- Eksisterende kodestil: norske kommentarer og UI-tekster, Linje-tokens (`--basecolors-*`, `--space-*`) i CSS.

## Review Focus

1. **Gemini svarer med feltnavn som ikke finnes, eller mangler felter** → ukjente forkastes, manglende blir bare stående uten forklaring (test i Task 2).
2. **Typen finnes i flere versjoner med ulik definisjon** (f.eks. v1.3 og v2.0) → to hurtigbufferoppføringer, hver versjonsfil får sin egen tekst (test i Task 1 og 4).
3. **Kjøringen avbrytes eller når `MAX_REQUESTS`** → det som er laget, er lagret; resten tas neste gang (test i Task 3).
4. **Forklaringsfilen mangler eller er ødelagt i appen** → ingen boks, ingen feilmelding, resten av siden virker (test i Task 6).
5. **Brukeren bytter versjon mens forklaringene lastes** → forklaringer fra forrige versjon vises ikke for den nye (test i Task 6).

---

## File Structure

| Fil | Ansvar |
|---|---|
| `scripts/explain/requests.js` | Bygger forespørsler (type/enum) fra versjonsdata, kanonisk feltvariant, hurtigbuffernøkkel |
| `scripts/explain/prompt.js` | `PROMPT_VERSION`, prompttekst, `responseSchema`, validering av svar |
| `scripts/explain/run.js` | Kjører manglende forespørsler mot en klient med samtidighet, nye forsøk og tak |
| `scripts/explain/output.js` | Bygger versjonsfil, rydder hurtigbuffer, lager PR-sammendrag |
| `scripts/explain/gemini.js` | Tynn adapter mot `@google/genai` |
| `scripts/explain.js` | CLI: leser filer, kobler delene, skriver filer |
| `scripts/explain/__tests__/*.test.js` | Enhetstester |
| `src/types.ts` | `Explanations`-typen |
| `src/data/loadVersion.ts` | `fetchExplanations` |
| `src/model/explanations.tsx` | `ExplanationsContext`, `useExplanation` |
| `src/components/AiExplanation.tsx` + `.css` | Boksen |
| `src/components/ElementPage.tsx`, `FieldDetail.tsx`, `EnumPage.tsx`, `src/App.tsx` | Viser boksen / laster filen |
| `.github/workflows/update-data.yml` | Ny jobb `explain` |
| `README.md` | Oppsett og drift |

---

### Task 1: Forespørsler og hurtigbuffernøkkel

**Files:**
- Create: `scripts/explain/requests.js`
- Test: `scripts/explain/__tests__/requests.test.js`

**Interfaces:**
- Produces:
  - `buildRequests(versions: VersionData[]): { requests: Request[], byVersion: Record<string, { types: string[], enums: string[] }> }`
    - `Request = TypeRequest | EnumRequest`, hver med `key: string` (fylles av `withKeys`), `id: string` (`type:<navn>` / `enum:<navn>`), `definition: object`, `context: object`.
    - `TypeRequest.definition = { kind: 'type', name, isElement: boolean, part?, module?, description, ancestors: string[], fields: FieldDef[], members: string[] }`, `FieldDef = { name, isAttribute, type, kind, minOccurs, maxOccurs, required, description }`.
    - `TypeRequest.context = { usedBy: string[] }` (maks 10, sortert). `members` maks 20, fra `substitutions`.
    - `EnumRequest.definition = { kind: 'enum', name, description, values: {value, description}[] }`, `context = { usedBy: string[] }` (maks 10, `Element.felt`).
    - Like definisjoner på tvers av versjoner gir én forespørsel; ulike gir to med samme `id` men ulik `key`.
    - `byVersion[v].types` / `.enums` er nøklene (`key`) som gjelder for versjonen.
  - `cacheKey(definition: object, model: string, promptVersion: string): string` — hex SHA-256 av `promptVersion + '\n' + model + '\n' + stableStringify(definition)`.
  - `withKeys(result, model, promptVersion)` — setter `key` på hver forespørsel og i `byVersion`. (Hold `buildRequests` uavhengig av modell.)
  - `stableStringify(value): string` — JSON med sorterte objektnøkler.

- [ ] **Step 1: Write the failing tests** — lag en liten `VersionData`-fixture i testfilen (to elementer `Line` og `LineView`, en abstrakt type `Entity` som bare finnes som `origin`, en struktur i `structures` med felt fra en origin som ikke er et element, en enum brukt av `Line.TransportMode`).

```js
it('lager én typeforespørsel per definerende type, også fra structures', () => {
  const { requests } = buildRequests([v20])
  expect(requests.filter(r => r.definition.kind === 'type').map(r => r.definition.name).sort())
    .toEqual(['Entity', 'KeyListStructure', 'Line', 'LineView'])
})
it('feltet på origin selv er kanonisk variant', () => {
  // Line.TransportMode har ulik beskrivelse på Line og LineView; Line er origin
  const line = typeReq('Line')
  expect(line.definition.fields.find(f => f.name === 'TransportMode').description).toBe('Mode of LINE.')
})
it('uten feltet på origin brukes vanligste variant, likt antall → alfabetisk første element', () => {
  const entity = typeReq('Entity')
  expect(entity.definition.fields.find(f => f.name === 'id').type).toBe('LineIdType')
})
it('like definisjoner i to versjoner gir én forespørsel', () => {
  expect(withKeys(buildRequests([v20, v20copy]), 'm', 'p').requests).toHaveLength(withKeys(buildRequests([v20]), 'm', 'p').requests.length)
})
it('ulik definisjon i to versjoner gir to nøkler med samme id', () => {
  const r = withKeys(buildRequests([v13, v20]), 'm', 'p')
  expect(r.requests.filter(x => x.id === 'type:Line').map(x => x.key)).toHaveLength(2)
})
it('usedBy påvirker ikke nøkkelen', () => {
  expect(cacheKey(def, 'm', 'p')).toBe(cacheKey(def, 'm', 'p'))
  // legg til et element som peker på Line → Line-nøkkelen er uendret
})
it('cacheKey endres med modell og promptversjon', () => { /* tre ulike nøkler */ })
it('usedBy er maks 10 og members maks 20', () => { /* fixture med 12 brukere og 25 medlemmer */ })
```

- [ ] **Step 2: Run** `npx vitest run scripts/explain/__tests__/requests.test.js` — Expected: FAIL (modul finnes ikke).
- [ ] **Step 3: Implement** `buildRequests`, `withKeys`, `cacheKey`, `stableStringify` i `scripts/explain/requests.js`. Definerende typer = alle `field.origin` i `elements[].fields` og `structures[*]`, pluss elementer uten egne felter. Elementer får `isElement: true`, `part`, `module`. «Brukes av» for en type: elementer med et felt der `refTarget === navn` eller `type === navn`.
- [ ] **Step 4: Run** samme kommando — Expected: PASS.
- [ ] **Step 5: Commit** `feat(explain): bygg forespørsler og hurtigbuffernøkler`

---

### Task 2: Prompt, svarskjema og validering

**Files:**
- Create: `scripts/explain/prompt.js`
- Test: `scripts/explain/__tests__/prompt.test.js`

**Interfaces:**
- Consumes: `Request` fra Task 1.
- Produces:
  - `PROMPT_VERSION: string` (start `'1'`).
  - `promptFor(request: Request): { system: string, user: string, schema: object }` — `schema` er Gemini `responseSchema`: type → `{ type: OBJECT, properties: { type: { type: STRING, nullable: true }, fields: { type: OBJECT, properties: {<hvert feltnavn>: STRING} } } }`; enum → `{ enum: STRING }`. Bruk strengverdiene `'OBJECT'`/`'STRING'` (Gemini-format), ikke import av SDK.
  - `validate(request: Request, raw: unknown): Output | null` der `Output = { type?: string, fields?: Record<string,string>, enum?: string }`. Trim tekst; dropp tomme strenger; dropp feltnavn som ikke er i `definition.fields`; `type` settes bare når `definition.isElement`; returnerer `null` når ingenting gyldig er igjen.

- [ ] **Step 1: Write the failing tests**

```js
it('systemprompten krever norsk bokmål, uoversatte NeTEx-navn og ren tekst', () => {
  const { system } = promptFor(typeReq)
  expect(system).toMatch(/bokmål/); expect(system).toMatch(/markdown/i)
})
it('brukerprompten inneholder definisjon og usedBy', () => {
  const { user } = promptFor(typeReq)
  expect(user).toContain('TransportMode'); expect(user).toContain('LineView')
})
it('schema har en egenskap per felt', () => {
  expect(Object.keys(promptFor(typeReq).schema.properties.fields.properties)).toEqual(['Name', 'TransportMode'])
})
it('validate forkaster ukjente felter og tomme tekster', () => {
  expect(validate(typeReq, { type: ' Forklaring. ', fields: { Name: 'A', Ghost: 'B', TransportMode: '  ' } }))
    .toEqual({ type: 'Forklaring.', fields: { Name: 'A' } })
})
it('validate dropper type for typer som ikke er elementer', () => {
  expect(validate(entityReq, { type: 'X', fields: { id: 'Y' } })).toEqual({ fields: { id: 'Y' } })
})
it('validate gir null for søppel', () => {
  expect(validate(typeReq, 'tekst')).toBeNull(); expect(validate(enumReq, { enum: '' })).toBeNull()
})
```

- [ ] **Step 2: Run** `npx vitest run scripts/explain/__tests__/prompt.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** i `scripts/explain/prompt.js`. Systemprompten (byggerens ordlyd) skal si: forklar for utviklere og fagfolk i kollektivtrafikk hva typen/feltet betyr og brukes til; hold deg til gitt definisjon og allmenn NeTEx/Transmodel-kunnskap; ikke nevn felter, verdier eller arv som ikke er gitt; lengdene fra Global Constraints; bokmål; NeTEx-navn uoversatt; ren tekst uten markdown. Brukerprompten er definisjon + kontekst som JSON.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(explain): prompt og validering av svar`

---

### Task 3: Kjøring med samtidighet, nye forsøk og tak

**Files:**
- Create: `scripts/explain/run.js`
- Test: `scripts/explain/__tests__/run.test.js`

**Interfaces:**
- Consumes: `Request`, `promptFor`, `validate`.
- Produces:
  - `Client = { generate(prompt: { system, user, schema }): Promise<unknown> }` — kaster `Error` med `status: number` ved HTTP-feil.
  - `Cache = Record<string /*key*/, { id: string, output: Output, createdAt: string }>`
  - `runExplain({ requests, cache, client, maxRequests = 2000, concurrency = 4, retries = 3, sleep = ms => new Promise(r => setTimeout(r, ms)), onEntry = () => {}, now = () => new Date().toISOString() }): Promise<{ made: number, failed: number, skipped: number }>` — muterer `cache`; kaller `onEntry()` etter hver ny oppføring (CLI bruker den til å lagre). `skipped` = forespørsler som ikke ble sendt pga. tak.

- [ ] **Step 1: Write the failing tests** (falsk klient, `sleep` som ikke venter)

```js
it('hopper over forespørsler som finnes i hurtigbufferen', async () => {
  const client = fakeClient(); await runExplain({ requests: [a, b], cache: { [a.key]: entryA }, client, sleep })
  expect(client.calls).toBe(1)
})
it('respekterer maxRequests og teller resten som skipped', async () => {
  const r = await runExplain({ requests: [a, b, c], cache: {}, client: fakeClient(), maxRequests: 2, sleep })
  expect(r).toEqual({ made: 2, failed: 0, skipped: 1 })
})
it('prøver igjen ved 429 og 503, maks 3 ganger', async () => { /* klient feiler 2 ganger med 429, så OK → made 1 */ })
it('gir opp etter 3 nye forsøk og fortsetter med resten', async () => { /* a feiler alltid med 500, b OK → failed 1, made 1 */ })
it('prøver ikke igjen ved 400', async () => { /* én kall, failed 1 */ })
it('lagrer ikke ugyldige svar', async () => { /* validate → null → failed 1, cache uendret */ })
it('kaller onEntry etter hver ny oppføring', async () => { /* 2 nye → onEntry 2 ganger */ })
it('kjører maks concurrency kall samtidig', async () => { /* klient måler maks samtidige; concurrency 2 → maks 2 */ })
```

- [ ] **Step 2: Run** `npx vitest run scripts/explain/__tests__/run.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** `runExplain` i `scripts/explain/run.js`. Eksponentiell pause (1 s, 2 s, 4 s) mellom forsøk ved `status` 429 eller ≥ 500; andre feil gir opp straks. Enkel arbeiderpool med `concurrency` arbeidere over en kø.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(explain): kjør forespørsler med tak og nye forsøk`

---

### Task 4: Versjonsfil, opprydding og PR-sammendrag

**Files:**
- Create: `scripts/explain/output.js`
- Test: `scripts/explain/__tests__/output.test.js`

**Interfaces:**
- Consumes: `buildRequests`/`withKeys`-resultat, `Cache`.
- Produces:
  - `ExplanationsFile = { version: string, model: string, generatedAt: string, types: Record<string,string>, fields: Record<string,string>, enums: Record<string,string> }`
  - `buildVersionFile({ version, keys: { types: string[], enums: string[] }, requests: Request[], cache: Cache, model: string, generatedAt: string }): ExplanationsFile` — `types[navn]` fra `output.type`, `fields['<navn>.<felt>']` fra `output.fields`, `enums[navn]` fra `output.enum`. Nøkler sortert, så diffen i PR-en blir stabil.
  - `pruneCache(cache: Cache, liveKeys: Set<string>): number` — fjerner oppføringer som ikke er i bruk, returnerer antall fjernet.
  - `summarize(before: Record<string, ExplanationsFile | null>, after: Record<string, ExplanationsFile>, { model, sampleSize = 10 }): string` — markdown for PR-beskrivelsen: modell, per versjon antall nye/endrede/fjernede tekster (types+fields+enums), og opptil `sampleSize` nye tekster som `- **Line**: …`. Første linje sier at teksten er KI-generert og må ses over før merge.

- [ ] **Step 1: Write the failing tests**

```js
it('bygger versjonsfil med type-, felt- og enum-tekster', () => {
  expect(buildVersionFile(args)).toMatchObject({ types: { Line: 'L.' }, fields: { 'Line.TransportMode': 'T.', 'Entity.id': 'I.' }, enums: { VehicleModeEnumeration: 'E.' } })
})
it('v1.3 og v2.0 får hver sin tekst når definisjonen er ulik', () => { /* to nøkler, to filer */ })
it('mangler i hurtigbufferen gir bare manglende oppføringer', () => { /* ingen kast */ })
it('pruneCache fjerner nøkler som ikke er i bruk', () => { expect(pruneCache(cache, new Set([a.key]))).toBe(1) })
it('summarize teller nye, endrede og fjernede per versjon', () => {
  expect(summarize({ 'v2.0': before }, { 'v2.0': after }, { model: 'm' })).toMatch(/v2\.0.*1 ny.*1 endret.*1 fjernet/s)
})
it('summarize håndterer at det ikke fantes noen fil før', () => { /* before null → alle nye */ })
```

- [ ] **Step 2: Run** `npx vitest run scripts/explain/__tests__/output.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** i `scripts/explain/output.js`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(explain): versjonsfiler, opprydding og PR-sammendrag`

---

### Task 5: Gemini-adapter og CLI

**Files:**
- Create: `scripts/explain/gemini.js`, `scripts/explain.js`
- Modify: `package.json` (script `"explain": "node scripts/explain.js"`; devDependency `@google/genai`)
- Modify: `.gitignore` (legg til `explain-summary.md`)
- Create: `data/explanations-cache.json` (`{}`), slik at stien finnes

**Interfaces:**
- Consumes: alt fra Task 1–4.
- Produces:
  - `createGeminiClient({ project, location, model, temperature = 0.2 }): Client` — `new GoogleGenAI({ vertexai: true, project, location })`, `models.generateContent({ model, contents: user, config: { systemInstruction: system, responseMimeType: 'application/json', responseSchema: schema, temperature } })`, returnerer `JSON.parse(response.text)`. SDK-feil med statuskode omformes til `Error` med `status`.
  - CLI-oppførsel (`scripts/explain.js`):
    1. Leser `public/data/versions.json`, laster hver `netex-<v>.json` uten `error`.
    2. `withKeys(buildRequests(...), model, PROMPT_VERSION)`; leser `data/explanations-cache.json`.
    3. Hvis `MAX_REQUESTS` > 0 og det mangler oppføringer: krever `GOOGLE_CLOUD_PROJECT` (ellers exit 1 med tydelig melding), lager klient, `runExplain` med `onEntry` som skriver hurtigbufferen maks hvert 25. kall.
    4. `pruneCache` mot alle `key` i bruk, skriver hurtigbufferen (sorterte nøkler, 2 mellomrom innrykk).
    5. Leser eksisterende `public/data/explanations-<v>.json` (eller `null`), skriver nye, skriver `explain-summary.md` med `summarize`.
    6. Logger `made/failed/skipped` og exit 0 selv om noen feilet (de tas neste natt); exit 1 bare ved konfigurasjonsfeil eller når *alle* forsøkte kall feilet.

- [ ] **Step 1: Installer** `npm install -D @google/genai` og legg til scriptet.
- [ ] **Step 2: Implement** `gemini.js` og `explain.js` som beskrevet.
- [ ] **Step 3: Kjør offline:** `MAX_REQUESTS=0 npm run explain` — Expected: exit 0, `public/data/explanations-v2.0.json` m.fl. finnes med tomme `types/fields/enums`, `explain-summary.md` skrevet, ingen nettverkskall.
- [ ] **Step 4: Kjør uten prosjekt:** `MAX_REQUESTS=5 npm run explain` (uten `GOOGLE_CLOUD_PROJECT`) — Expected: exit 1 med melding som nevner `GOOGLE_CLOUD_PROJECT`.
- [ ] **Step 5: Kjør alle skripttester:** `npx vitest run scripts` — Expected: PASS.
- [ ] **Step 6: Commit** `feat(explain): CLI og Gemini-klient` (ta med de tomme versjonsfilene og `data/explanations-cache.json`).

*(Prøvekjøring mot Vertex AI med `MAX_REQUESTS=20` gjøres når GCP-prosjektet finnes; ikke en del av denne oppgaven.)*

---

### Task 6: Vise forklaringer i appen

**Files:**
- Modify: `src/types.ts` (legg til `Explanations` = `ExplanationsFile` fra Task 4, i TypeScript)
- Modify: `src/data/loadVersion.ts`
- Create: `src/model/explanations.tsx`
- Create: `src/components/AiExplanation.tsx`, `src/components/AiExplanation.css`
- Modify: `src/App.tsx`, `src/components/ElementPage.tsx`, `src/components/FieldDetail.tsx`, `src/components/EnumPage.tsx`
- Test: `src/components/__tests__/AiExplanation.test.tsx`, `src/__tests__/App.test.tsx`, eksisterende `ElementPage.test.tsx`, `EnumPage.test.tsx`, `StructureTab.test.tsx`

**Interfaces:**
- Consumes: filformatet fra Task 4.
- Produces:
  - `fetchExplanations(version: string): Promise<Explanations | null>` — `null` ved 404, nettverksfeil, ugyldig JSON eller når `version` i filen ikke stemmer.
  - `ExplanationsContext = createContext<Explanations | null>(null)`; `useExplanation(kind: 'types' | 'fields' | 'enums', key: string): string | undefined`.
  - `<AiExplanation text={string | undefined} />` — rendrer ingenting når `text` mangler. Ellers `<aside aria-label="Forklaring (KI-generert)">` med overskrift «Forklaring (KI-generert)», teksten, og merknaden «Laget av KI og kan inneholde feil. Beskrivelsen fra XSD-en er den offisielle.».
  - App: henter `fetchExplanations(state.v)` i egen effekt (avbrytes ved versjonsbytte), lagrer `{ version, data }`, og gir `ExplanationsContext.Provider` verdien bare når `version === state.v`.
  - ElementPage: `<AiExplanation text={useExplanation('types', element.name)} />` rett etter XSD-beskrivelsen.
  - FieldDetail: `useExplanation('fields', `${f.origin}.${f.name}`)` rett etter `field-detail__description`.
  - EnumPage: `useExplanation('enums', enumType.name)` rett etter XSD-beskrivelsen.

- [ ] **Step 1: Write the failing tests**

```tsx
it('AiExplanation viser etikett, tekst og merknad', () => {
  render(<AiExplanation text="En linje er …" />)
  expect(screen.getByRole('complementary', { name: 'Forklaring (KI-generert)' })).toHaveTextContent('En linje er …')
  expect(screen.getByText(/kan inneholde feil/)).toBeInTheDocument()
})
it('AiExplanation rendrer ingenting uten tekst', () => {
  const { container } = render(<AiExplanation text={undefined} />); expect(container).toBeEmptyDOMElement()
})
it('ElementPage viser typeforklaring fra konteksten under XSD-beskrivelsen', () => { /* Provider med types.StopPlace */ })
it('FieldDetail bruker <origin>.<navn>', () => { /* StructureTab: velg Name (origin Zone) → viser fields['Zone.Name'] */ })
it('EnumPage viser enumforklaring', () => { /* enums.StopTypeEnumeration */ })
it('App virker når forklaringsfilen gir 404', async () => { /* fetch-mock: explanations → 404; elementsiden vises, ingen boks, ingen feilbanner */ })
it('App viser ikke forrige versjons forklaringer etter versjonsbytte', async () => { /* v2.0 har tekst, v1.3-fil henger → ingen boks på v1.3 */ })
```

- [ ] **Step 2: Run** `npx vitest run src` — Expected: FAIL (nye tester).
- [ ] **Step 3: Implement** endringene. CSS: dempet boks med `--basecolors-frame-subdued` (eller nærmeste Linje-token som finnes i `@entur/tokens`), `--space-small` innvendig luft, `--basecolors-text-subdued` for merknaden; virker i mørk modus fordi bare tokens brukes.
- [ ] **Step 4: Run** `npx vitest run && npm run lint && npm run build` — Expected: alt PASS, bygget lykkes.
- [ ] **Step 5: Se i nettleseren:** `npm run dev`, legg inn en håndskrevet `public/data/explanations-v2.0.json` med tekst for `StopPlace`, `Zone.Name` og `StopTypeEnumeration` (ikke commit den), sjekk elementside, strukturfanen og enumside i lys og mørk modus.
- [ ] **Step 6: Commit** `feat(ui): vis KI-genererte forklaringer`

---

### Task 7: CI-jobb og README

**Files:**
- Modify: `.github/workflows/update-data.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: `npm run explain`, `explain-summary.md`.

- [ ] **Step 1: Legg til jobb `explain`** i `update-data.yml`:
  - `needs: update`, `if: ${{ vars.GOOGLE_CLOUD_PROJECT != '' && vars.GCP_WIF_PROVIDER != '' && vars.GCP_SERVICE_ACCOUNT != '' }}`
  - `permissions: { contents: write, pull-requests: write, id-token: write }`
  - Steg: checkout `ref: main` (for å få dagens data-commit) → setup-node 24 med npm-cache → `npm ci` → `google-github-actions/auth@v2` med `workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}`, `service_account: ${{ vars.GCP_SERVICE_ACCOUNT }}` → `npm run explain` med `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION: ${{ vars.GOOGLE_CLOUD_LOCATION || 'europe-west1' }}`, `GEMINI_MODEL: ${{ vars.GEMINI_MODEL || 'gemini-3.5-flash-lite' }}` → `npx vitest run scripts/explain` → `peter-evans/create-pull-request@v7` med `branch: ki-forklaringer`, `base: main`, `title: 'chore: KI-genererte forklaringer'`, `body-path: explain-summary.md`, `add-paths: data/explanations-cache.json, public/data/explanations-*.json`, `commit-message: 'chore: oppdater KI-genererte forklaringer'`, `delete-branch: true`.
  - Behold `update`- og `deploy`-jobbene uendret.
- [ ] **Step 2: Valider syntaks:** `npx --yes @action-validator/cli .github/workflows/update-data.yml` (eller `actionlint` hvis installert) — Expected: ingen feil.
- [ ] **Step 3: README** — ny seksjon «KI-genererte forklaringer»: hva det er, `npm run explain` lokalt (`gcloud auth application-default login`, `GOOGLE_CLOUD_PROJECT`, `MAX_REQUESTS=20` for prøve), miljøvariabler med standardverdier, hvordan PR-gjennomgangen fungerer, og oppsett utenfor repoet: GCP-prosjekt med Vertex AI API, tjenestekonto med `roles/aiplatform.user`, Workload Identity-pool med `attribute-condition` `assertion.repository == 'entur/netex-overview' && assertion.ref == 'refs/heads/main'`, budsjettvarsel, repo-variablene `GOOGLE_CLOUD_PROJECT`, `GCP_WIF_PROVIDER`, `GCP_SERVICE_ACCOUNT` (valgfritt `GOOGLE_CLOUD_LOCATION`, `GEMINI_MODEL`), innstillingen «Allow GitHub Actions to create and approve pull requests», og registrering i KI-løypa (<https://ki.entur.no/ki-loypa>). Oppdater også «Funksjoner»-listen.
- [ ] **Step 4: Run** `npx vitest run && npm run lint` — Expected: PASS.
- [ ] **Step 5: Commit** `ci: lag PR med KI-genererte forklaringer hver natt`
