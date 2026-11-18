/** Versjon av prompten. Inngår i hurtigbuffernøkkelen; øk den når prompt eller skjema endres. */
export const PROMPT_VERSION = '1'

const SYSTEM = `Du forklarer NeTEx-datamodellen for utviklere som lager NeTEx-eksport og for fagfolk i kollektivselskaper.
Forklar hva typen, feltet eller enumerasjonen betyr og hva den brukes til.
Hold deg til definisjonen du får oppgitt og allmenn kunnskap om NeTEx og Transmodel. Ikke nevn felter, verdier eller arv som ikke er oppgitt i definisjonen.
Skriv på norsk bokmål. NeTEx-navn (elementer, felter og verdier) skrives uoversatt, akkurat slik de er oppgitt.
Skriv ren tekst uten markdown, punktlister, overskrifter eller kodeformatering.
Lengde: forklaringen av en type er 3 til 5 setninger, forklaringen av hvert felt er 1 til 2 setninger, og forklaringen av en enumerasjon er 2 til 4 setninger.
For en type som ikke er et element (isElement er false), skal "type" være null; forklar bare feltene.
Svar kun med JSON som følger det oppgitte skjemaet.`

const STR = { type: 'STRING' }

function schemaFor(definition) {
  if (definition.kind === 'enum') {
    return { type: 'OBJECT', properties: { enum: { ...STR } }, required: ['enum'] }
  }
  const fieldProps = {}
  for (const f of definition.fields ?? []) fieldProps[f.name] = { ...STR }
  // Gemini avviser OBJECT med tom properties, så fields utelates for typer uten felter
  const properties = { type: { type: 'STRING', nullable: true } }
  if (Object.keys(fieldProps).length) properties.fields = { type: 'OBJECT', properties: fieldProps }
  return { type: 'OBJECT', properties }
}

/** Bygger systemprompt, brukerprompt (definisjon og kontekst som JSON) og responseSchema. */
export function promptFor(request) {
  const { definition, context } = request
  const user = JSON.stringify({ definition, context }, null, 2)
  return { system: SYSTEM, user, schema: schemaFor(definition) }
}

const text = (v) => (typeof v === 'string' ? v.trim() : '')

/** Validerer modellens svar mot forespørselen. Gir null når ingenting gyldig er igjen. */
export function validate(request, raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const { definition } = request

  if (definition.kind === 'enum') {
    const e = text(raw.enum)
    return e ? { enum: e } : null
  }

  const out = {}
  const t = text(raw.type)
  if (definition.isElement && t) out.type = t

  if (raw.fields && typeof raw.fields === 'object' && !Array.isArray(raw.fields)) {
    const known = new Set((definition.fields ?? []).map((f) => f.name))
    const fields = {}
    for (const [name, value] of Object.entries(raw.fields)) {
      const v = text(value)
      if (known.has(name) && v) fields[name] = v
    }
    if (Object.keys(fields).length) out.fields = fields
  }
  return Object.keys(out).length ? out : null
}
