import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { parseXsd } from './parser/xsd-parser.js'
import { resolveModel } from './parser/model-resolver.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '../public/data')

const GITHUB_API = 'https://api.github.com/repos/NeTEx-CEN/NeTEx'
const GITHUB_CONTENTS_API = `${GITHUB_API}/contents`
const BRANCHES_API = `${GITHUB_API}/branches`

const EXAMPLES_DIR = 'examples/functions/fares'

// Use GITHUB_TOKEN env var or fall back to gh CLI token to avoid rate limits
async function getAuthHeaders() {
  const token = process.env.GITHUB_TOKEN
  if (token) return { Authorization: `Bearer ${token}` }
  try {
    const { execSync } = await import('child_process')
    const ghToken = execSync('gh auth token', { encoding: 'utf8' }).trim()
    if (ghToken) return { Authorization: `Bearer ${ghToken}` }
  } catch { /* gh not available */ }
  return {}
}

const AUTH_HEADERS = await getAuthHeaders()

/**
 * Fetch list of branches from GitHub that match version pattern
 * @returns {Promise<string[]>} Array of branch names like ['v1.3', 'v2.0', 'v2.1-wip', 'v3.0-wip']
 */
async function fetchBranches() {
  const res = await fetch(`${BRANCHES_API}?per_page=100`, { headers: AUTH_HEADERS })
  if (!res.ok) throw new Error(`Failed to fetch branches: ${res.status}`)
  const branches = await res.json()
  return branches
    .map(b => b.name)
    .filter(name => /^v\d+\.\d+(-wip)?$/.test(name))  // Only vX.Y or vX.Y-wip
    .sort((a, b) => {
      // Sort by version number
      const parseVer = (v) => {
        const match = v.match(/^v(\d+)\.(\d+)/)
        if (!match) return [0, 0]
        return [parseInt(match[1]), parseInt(match[2])]
      }
      const [aMaj, aMin] = parseVer(a)
      const [bMaj, bMin] = parseVer(b)
      if (aMaj !== bMaj) return aMaj - bMaj
      return aMin - bMin
    })
}

async function listFiles(dir, version = 'master') {
  const res = await fetch(`${GITHUB_CONTENTS_API}/${dir}?ref=${version}`, { headers: AUTH_HEADERS })
  if (!res.ok) throw new Error(`Failed to list ${dir}: ${res.status}`)
  return res.json()
}

async function fetchText(path, version = 'master') {
  const rawBase = `https://raw.githubusercontent.com/NeTEx-CEN/NeTEx/${version}`
  const res = await fetch(`${rawBase}/${path}`, { headers: AUTH_HEADERS })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`)
  return res.text()
}

/**
 * Recursively list all XSD _version/_support files under a top-level directory.
 * @param {string} topDir
 * @param {string} version
 * @returns {Promise<string[]>}
 */
async function listXsdFilesDeep(topDir, version = 'master') {
  const files = []
  const entries = await listFiles(topDir, version)
  for (const entry of entries) {
    if (entry.type === 'dir') {
      const nested = await listXsdFilesDeep(entry.path, version)
      files.push(...nested)
    } else if (
      entry.name.endsWith('.xsd') &&
      (entry.name.includes('_version') || entry.name.includes('_support'))
    ) {
      files.push(entry.path)
    }
  }
  return files
}

async function buildModel(version = 'master') {
  const ctx = {
    elements: new Map(), types: new Map(), groups: new Map(),
    enums: new Map(), listTypes: new Map(), attributeGroups: new Map(),
  }
  const partMap = new Map()

  console.log(`\n📦 Building model for ${version}...`)

  // part 0 = framework; later parts win on name clashes
  const sources = [
    { label: 'framework', part: 0, top: 'xsd/netex_framework' },
    { label: 'Part 1', part: 1, top: 'xsd/netex_part_1' },
    { label: 'Part 2', part: 2, top: 'xsd/netex_part_2' },
    { label: 'Part 3', part: 3, top: 'xsd/netex_part_3' },
  ]
  for (const { label, part, top } of sources) {
    const paths = await listXsdFilesDeep(top, version)
    console.log(`  Found ${paths.length} ${label} XSD files`)
    for (const path of paths) {
      process.stdout.write(`    Parsing ${path.split('/').pop()}...`)
      const text = await fetchText(path, version)
      if (!text) { console.log(' skipped (404)'); continue }
      const parsed = parseXsd(text, path)
      for (const key of Object.keys(ctx)) for (const [k, v] of parsed[key]) ctx[key].set(k, v)
      for (const k of parsed.elements.keys()) partMap.set(k, part)
      console.log(' done')
    }
  }

  console.log('  Resolving model...')
  const { elements, enums, structures } = resolveModel(ctx, partMap)
  console.log(`  ✓ Resolved ${elements.length} elements, ${Object.keys(enums).length} enums, ${Object.keys(structures).length} structures`)
  return { elements, enums, structures }
}

async function buildExamplesJson(version) {
  console.log(`\n📄 Building examples for ${version}...`)
  try {
    const entries = await listFiles(EXAMPLES_DIR, version)
    const xmlFiles = entries.filter((e) => e.name.endsWith('.xml'))
    console.log(`  Found ${xmlFiles.length} example XML files`)

    const examples = []
    for (const file of xmlFiles) {
      process.stdout.write(`    Fetching ${file.name}...`)
      const xml = await fetchText(file.path, version)
      const label = file.name
        .replace(/\.xml$/, '')
        .replace(/^Netex_\d+\.\d+_/, '')
        .replace(/_/g, ' ')
      examples.push({ filename: file.name, label, xml })
      console.log(' done')
    }

    return examples
  } catch (err) {
    console.log(`  ⚠️  No examples found for ${version} (${err.message})`)
    return []
  }
}

async function main() {
  console.log('=== NeTEx Multi-Version Fetch & Parse ===\n')
  mkdirSync(DATA_DIR, { recursive: true })

  const requested = process.argv.slice(2)
  console.log('🔍 Fetching available NeTEx versions from GitHub...')
  const available = await fetchBranches()
  const branches = requested.length ? requested : available
  const unknown = branches.filter((b) => !available.includes(b))
  if (unknown.length) throw new Error(`Unknown version(s): ${unknown.join(', ')}. Available: ${available.join(', ')}`)
  console.log(`Processing ${branches.length} versions: ${branches.join(', ')}\n`)

  const versionsData = []
  for (const version of branches) {
    console.log(`\n${'='.repeat(60)}\nProcessing ${version}\n${'='.repeat(60)}`)
    try {
      const { elements, enums, structures } = await buildModel(version)
      const examples = await buildExamplesJson(version)
      const fetchedAt = new Date().toISOString()
      const file = `netex-${version}.json`
      writeFileSync(join(DATA_DIR, file), JSON.stringify({ version, fetchedAt, elements, enums, structures, examples }))
      console.log(`  ✓ Wrote ${file}`)
      versionsData.push({ version, file, elementCount: elements.length, enumCount: Object.keys(enums).length, fetchedAt })
    } catch (err) {
      console.error(`  ❌ Error processing ${version}:`, err.message)
      versionsData.push({ version, error: err.message })
    }
  }

  // A partial run must not drop the other versions from the manifest.
  const manifestPath = join(DATA_DIR, 'versions.json')
  let previous = []
  if (requested.length && existsSync(manifestPath)) {
    previous = JSON.parse(readFileSync(manifestPath, 'utf8')).versions.filter((v) => !branches.includes(v.version))
  }
  const byVersion = (a, b) => available.indexOf(a.version) - available.indexOf(b.version)
  const versions = [...previous, ...versionsData].sort(byVersion)
  writeFileSync(manifestPath, JSON.stringify({ generatedAt: new Date().toISOString(), versions }))
  console.log(`\n✓ Wrote versions.json with ${versions.length} versions`)

  console.log('\nSummary:')
  for (const v of versionsData) {
    console.log(v.error ? `  ❌ ${v.version}: ${v.error}` : `  ✓ ${v.version}: ${v.elementCount} elements, ${v.enumCount} enums`)
  }
  if (versionsData.some((v) => v.error)) process.exitCode = 1
}

main().catch((err) => { console.error(err); process.exit(1) })
