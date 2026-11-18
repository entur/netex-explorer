# NeTEx-utforsker

Interaktiv utforsker for NeTEx-standarden (Network Timetable Exchange), bygget med Entur sitt designsystem Linje.

Appen ligger på <https://entur.github.io/netex-explorer/>.

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
