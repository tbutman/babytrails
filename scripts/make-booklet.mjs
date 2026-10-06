// Draws made-up health booklet growth pages as "photos", for the demo and the tests. Nothing in them
// is real: the rows come from src/app/demoBooklet.json (English, the demo baby) and
// tests/fixtures/booklet/rows-pt.json (Portuguese, a test baby). Each page is drawn several times as
// rows are added, the way a parent photographs the same page at every check-up.
//
// The handwriting fonts (Caveat and Kalam, SIL Open Font Licence) are dev dependencies used only
// here; the app never ships them.
//
//   node scripts/make-booklet.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const font = (pkg, file) => `data:font/woff2;base64,${readFileSync(join(root, 'node_modules/@fontsource', pkg, 'files', file)).toString('base64')}`
const HANDS = `
@font-face { font-family: Hand1; src: url(${font('caveat', 'caveat-latin-600-normal.woff2')}) format('woff2'); }
@font-face { font-family: Hand2; src: url(${font('kalam', 'kalam-latin-400-normal.woff2')}) format('woff2'); }`

// A small seeded random, so the pages come out the same every time.
function random(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])

function page(data, count, { thumb, seed }) {
  const rnd = random(seed)
  const wobble = (n) => (rnd() - 0.5) * n
  const rows = data.rows.slice(0, count)
  const emptyRows = 14 - rows.length
  const cell = (text, hand, i) =>
    text
      ? `<td><span class="ink hand${hand}" style="transform: translate(${wobble(6)}px, ${wobble(4)}px) rotate(${wobble(3)}deg)">${esc(text)}</span>${i === 0 && thumb ? '' : ''}</td>`
      : '<td></td>'
  const body = rows
    .map((r) => {
      const tds = r.cells.map((t, i) => cell(t, r.hand, i)).join('')
      const note = r.note ? `<span class="ink hand${r.hand} note" style="transform: rotate(${wobble(2) - 1}deg)">${esc(r.note)}</span>` : ''
      return `<tr>${tds.replace(/<\/td>$/, `${note}</td>`)}</tr>`
    })
    .join('')
  const blanks = Array.from({ length: emptyRows }, () => `<tr>${'<td></td>'.repeat(data.headers.length)}</tr>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${HANDS}
html, body { margin: 0; }
body { width: 1100px; height: 1460px; background: radial-gradient(circle at 30% 20%, #c9b79c, #8f7a5e 70%, #6e5c45); display: grid; place-items: center; overflow: hidden; }
.sheet { position: relative; width: 900px; height: 1280px; background: linear-gradient(170deg, #fbf8f1, #f1ece0); box-shadow: 0 30px 60px rgb(0 0 0 / 0.35), 0 4px 10px rgb(0 0 0 / 0.2); transform: rotate(${(wobble(2.4) - 1.2).toFixed(2)}deg) perspective(1600px) rotateX(2deg); padding: 70px 64px; box-sizing: border-box; font-family: Georgia, 'Times New Roman', serif; color: #2b2b2b; }
.sheet::after { content: ''; position: absolute; inset: 0; background: linear-gradient(115deg, rgb(255 255 255 / 0.25), transparent 40%, rgb(0 0 0 / 0.08)); pointer-events: none; }
h1 { font-style: italic; font-weight: 700; font-size: 40px; margin: 0 0 6px; color: #3a3a3a; }
.rule { height: 3px; background: #3a3a3a; width: 60%; margin-bottom: 40px; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th { font-weight: 400; font-size: 19px; line-height: 1.15; padding: 10px 4px; border: 2px solid #3a3a3a; vertical-align: middle; }
td { position: relative; height: 54px; border: 1.5px solid #555; padding: 0 4px; white-space: nowrap; overflow: visible; }
th:nth-child(1) { width: 20%; } th:nth-child(2) { width: 12%; } th:nth-child(3) { width: 12%; }
.ink { display: inline-block; position: relative; z-index: 1; }
.hand1 { font-family: Hand1; font-size: 30px; color: #1f2f7a; }
.hand2 { font-family: Hand2; font-size: 25px; color: #2a2a2a; letter-spacing: -0.5px; }
.note { position: absolute; left: -190px; top: 8px; font-size: 28px; white-space: nowrap; }
.foot { margin-top: 30px; font-style: italic; font-size: 26px; font-weight: 700; color: #3a3a3a; }
.foot p { font-style: normal; font-weight: 400; font-size: 21px; margin: 8px 0 0; }
.thumb { position: absolute; left: -70px; top: 236px; width: 230px; height: 92px; border-radius: 46px 60px 60px 46px; background: linear-gradient(175deg, #e8b597, #cf9576 55%, #b27a5f); box-shadow: 0 10px 20px rgb(0 0 0 / 0.3); transform: rotate(-8deg); z-index: 2; }
.thumb::after { content: ''; position: absolute; right: 12px; top: 14px; width: 62px; height: 54px; border-radius: 45% 50% 50% 45%; background: linear-gradient(160deg, #f4d4c2, #e3b59c); opacity: 0.9; }
</style></head><body><div class="sheet">
<h1>${esc(data.title)}</h1><div class="rule"></div>
<table><thead><tr>${data.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body}${blanks}</tbody></table>
<div class="foot">${esc(data.subtitle.split(':')[0])}:<p>${esc(data.subtitle.split(':').slice(1).join(':').trim())}</p></div>
${thumb ? '<div class="thumb"></div>' : ''}
</div></body></html>`
}

const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' })
const tab = await browser.newPage({ viewport: { width: 1100, height: 1460 } })
async function shoot(data, count, opts, path) {
  await tab.setContent(page(data, count, opts))
  await tab.evaluate(() => document.fonts.ready)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, await tab.screenshot({ type: 'jpeg', quality: 78 }))
  console.log(`Wrote ${path.replace(`${root}/`, '')}`)
}

const en = JSON.parse(readFileSync(join(root, 'src/app/demoBooklet.json'), 'utf8'))
const pt = JSON.parse(readFileSync(join(root, 'tests/fixtures/booklet/rows-pt.json'), 'utf8'))
// The demo's page: the latest photo, every row, a thumb over the first date.
await shoot(en, en.versions.at(-1), { thumb: true, seed: 7 }, join(root, 'public/demo/booklet-page.jpg'))
// The test pages: the same Portuguese page photographed three times.
for (const [i, n] of pt.versions.entries()) {
  await shoot(pt, n, { thumb: i === pt.versions.length - 1, seed: 11 + i }, join(root, `tests/fixtures/booklet/pt-${i + 1}.jpg`))
}
await browser.close()
