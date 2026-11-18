# NeTEx-utforsker

Interaktiv utforsker for NeTEx-standarden (Network Timetable Exchange), bygget med Entur sitt designsystem Linje.

## Funksjoner

- Elementer gruppert etter del og modul, med søk i elementer og felter (også arvede)
- Elementside med felttabell, arvekjede (filtrer på opphav), strukturvisning som XML-tre og XML-instans fra lastet fil
- Enum-sider med verdier og oversikt over hvilke felter som bruker enumen
- Bytte mellom NeTEx-versjoner (v1.3, v2.0, v2.1-wip, v3.0-wip); versjon, element, enum og fane ligger i URL-en
- Last inn NeTEx-eksempler, lokal XML-fil eller limt inn XML og se verdiene til instanser

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
BASE_PATH=/netex-overview/ npm run build
```

#### Uniformen

Ved bygging (og ved `npm run dev`) hentes Entur sitt felles skall fra Uniformen
(`https://uniformen.entur.no/ssr?simple=true&locale=nb-NO`, tidsavbrudd 2000 ms) og settes inn i `index.html`.
Feiler kallet, bygges appen uten skall.

### Skrifter

Entur sin skrift Nationale er lisensiert, og repoet har ingen egne filer for den. Inntil skriftfilene er lagt til brukes Arial
som reserve.

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
