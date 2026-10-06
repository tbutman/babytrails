// Downloads WHO's Child Growth Standards tables and converts them to JSON for the app.
//
// The tables are © World Health Organization and are not covered by this repository's MIT licence,
// so they're never committed (see DATA-NOTICE.md). Each file is pinned to a URL and a SHA-256
// checksum: if WHO re-uploads a file, the build stops instead of silently changing the data.
// Downloads are cached in .cache/who/; the output goes to src/growth/data/ (both git-ignored).

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { strFromU8, unzipSync } from 'fflate'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const cacheDir = join(root, '.cache/who')
const outDir = join(root, 'src/growth/data')
const base = 'https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators'

// indicator, sex, path under `base`, SHA-256 (downloaded and checked 6 October 2026)
const FILES = [
  ['wfa', 'male', 'weight-for-age/expanded-tables/wfa-boys-zscore-expanded-tables.xlsx?sfvrsn=65cce121_10', 'b5b4748c6bfa5230e2eddafa1767629c349178b08d457f400b59422b8bfef86c'],
  ['wfa', 'female', 'weight-for-age/expanded-tables/wfa-girls-zscore-expanded-tables.xlsx?sfvrsn=f01bc813_10', 'ee3ae12cb96c6c5541cdf43665c03ce6c984f877859a183a5f6104eb06a49a6e'],
  ['lhfa', 'male', 'length-height-for-age/expandable-tables/lhfa-boys-zscore-expanded-tables.xlsx?sfvrsn=7b4a3428_12', 'c4b1c9029ab9751a5f0888e32f35c7c0287a16d361885cf911ecf23b3f7f6b4f'],
  ['lhfa', 'female', 'length-height-for-age/expandable-tables/lhfa-girls-zscore-expanded-tables.xlsx?sfvrsn=27f1e2cb_10', '6aa2876319449a6b1f4d825848128902114ff53c67b92b86a0c5140846013059'],
  ['wfl', 'male', 'weight-for-length-height/expanded-tables/wfl-boys-zscore-expanded-table.xlsx?sfvrsn=d307434f_8', '1a6e9a002d2692d038161bc6572a10f8b9fa0657163808141d2981a2132c59cc'],
  ['wfl', 'female', 'weight-for-length-height/expanded-tables/wfl-girls-zscore-expanded-table.xlsx?sfvrsn=db7b5d6b_8', 'ec116b8e618ad311d34a87231346badf16c75f5c4f82222ec846e05c582bf16a'],
  ['wfh', 'male', 'weight-for-length-height/expanded-tables/wfh-boys-zscore-expanded-tables.xlsx?sfvrsn=ac60cb13_8', 'ed3b590f9c65937a138408b13618f33684bb6406a0c56d6a2ce3fd9053a3f59f'],
  ['wfh', 'female', 'weight-for-length-height/expanded-tables/wfh-girls-zscore-expanded-tables.xlsx?sfvrsn=daac732c_8', 'fca340d5f04aa1556ac410b176b65b290e1b9ff467fc854a97f9b54ad94c9b8a'],
  ['hcfa', 'male', 'head-circumference-for-age/expanded-tables/hcfa-boys-zscore-expanded-tables.xlsx?sfvrsn=2ab1bec8_8', '89a657bc466e85f6c8f2e5e7f4635e969bdcf982bb71e519273e43896a1c3314'],
  ['hcfa', 'female', 'head-circumference-for-age/expanded-tables/hcfa-girls-zscore-expanded-tables.xlsx?sfvrsn=3a34b8b0_8', '8eec3770d1027ce1b3b96a7b89fd1e77070558a7791b17b4462cda8a813324a3'],
  ['bfa', 'male', 'body-mass-index-for-age/expanded-tables/bfa-boys-zscore-expanded-tables.xlsx?sfvrsn=f8e1fbe2_10', '58dcb2abea0e04b1c4f8ad3511d05ec1bea03741f230ac127b93f929e4cc6fc8'],
  ['bfa', 'female', 'body-mass-index-for-age/expanded-tables/bfa-girls-zscore-expanded-tables.xlsx?sfvrsn=ae4cb8d1_12', 'd3817262a383cdd02553b004f1c6110527d30b729c70501d032e71caadc17529'],
]

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

async function load([indicator, sex, path, expected]) {
  const file = join(cacheDir, `${indicator}-${sex}.xlsx`)
  let bytes = existsSync(file) ? readFileSync(file) : null
  if (!bytes || sha256(bytes) !== expected) {
    const response = await fetch(`${base}/${path}`)
    if (!response.ok) throw new Error(`WHO download failed (${response.status}): ${path}`)
    bytes = Buffer.from(await response.arrayBuffer())
    const actual = sha256(bytes)
    if (actual !== expected) {
      throw new Error(`WHO file changed: ${indicator} ${sex}\n  expected ${expected}\n  got      ${actual}\nCheck what changed before updating the checksum.`)
    }
    writeFileSync(file, bytes)
  }
  return bytes
}

// Reads the first sheet: a header row (Day or Length/Height, L, M, S, SD columns) then numbers.
function parseSheet(bytes) {
  const files = unzipSync(new Uint8Array(bytes))
  const strings = [...strFromU8(files['xl/sharedStrings.xml']).matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1])
  const rows = []
  for (const [, rowXml] of strFromU8(files['xl/worksheets/sheet1.xml']).matchAll(/<row[^>]*>(.*?)<\/row>/gs)) {
    const cells = {}
    for (const [, col, attrs, value] of rowXml.matchAll(/<c r="([A-Z]+)\d+"([^>]*)>(?:<f>[^<]*<\/f>)?<v>([^<]*)<\/v><\/c>/g)) {
      cells[col] = attrs.includes('t="s"') ? strings[Number(value)] : Number(value)
    }
    rows.push(cells)
  }
  const [header, ...data] = rows
  const column = (name) => Object.keys(header).find((key) => header[key] === name)
  const xCol = column('Day') ?? column('Length') ?? column('Height')
  const [lCol, mCol, sCol] = ['L', 'M', 'S'].map(column)
  if (!xCol || !lCol || !mCol || !sCol) throw new Error(`Unexpected columns: ${JSON.stringify(header)}`)
  return {
    x: header[xCol] === 'Day' ? 'day' : 'cm',
    rows: data.map((row) => [row[xCol], row[lCol], row[mCol], row[sCol]]),
  }
}

mkdirSync(cacheDir, { recursive: true })
mkdirSync(outDir, { recursive: true })
const tables = {}
for (const entry of FILES) {
  const [indicator, sex] = entry
  const { x, rows } = parseSheet(await load(entry))
  // Rows are evenly spaced (1 day, or 0.1 cm); store the start, step and L, M, S columns.
  const step = Math.round((rows[1][0] - rows[0][0]) * 1000) / 1000
  rows.forEach((row, i) => {
    if (Math.abs(row[0] - (rows[0][0] + i * step)) > 1e-6) throw new Error(`${indicator} ${sex}: uneven row ${i}`)
  })
  tables[indicator] ??= { x, step, start: rows[0][0], male: null, female: null }
  tables[indicator][sex] = { L: rows.map((r) => r[1]), M: rows.map((r) => r[2]), S: rows.map((r) => r[3]) }
}
for (const [indicator, table] of Object.entries(tables)) {
  writeFileSync(join(outDir, `${indicator}.json`), JSON.stringify(table))
}
console.log(`WHO tables ready: ${Object.keys(tables).join(', ')}`)
