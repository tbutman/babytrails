// Renders the app icons and the Open Graph image (for link previews) with local headless Chrome, as
// tbutman-site does. Run by hand after changing the design; the PNGs are committed.
//   node scripts/make-images.mjs

import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const font = readFileSync(join(root, 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')).toString('base64')
const INK = '#1D2340'
const HONEY = '#F2C45A'
const HONEY_FILL = '#E0A21E'
const HONEY_TEXT = '#8F5C00'
const WARM = '#FAF9F6'

// The Trails mark (src/core/ui/components.tsx, TrailMark): a rising curve with three dots, in honey on
// ink. `pad` is the share of the canvas left empty around it (maskable icons need a safe zone).
const icon = (size, pad, rounded) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${rounded ? 14 : 0}" fill="${INK}"/>
  <g transform="translate(32 32) scale(${(1 - pad) * 1.55}) translate(-14 -9.5)">
    <path d="M4 15 C 9 14, 12 10, 14 9 S 20 5, 24 4" fill="none" stroke="${HONEY}" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="4" cy="15" r="3" fill="${HONEY}"/><circle cx="14" cy="9" r="3" fill="${HONEY}"/><circle cx="24" cy="4" r="3" fill="${HONEY}"/>
  </g>
</svg>`

const og = `<!doctype html><html><head><style>
@font-face { font-family: Inter; font-weight: 100 900; src: url(data:font/woff2;base64,${font}) format('woff2'); }
body { margin: 0; width: 1200px; height: 630px; background: ${WARM}; font-family: Inter, Helvetica, Arial, sans-serif; color: ${INK}; display: flex; }
.left { padding: 88px 0 0 88px; width: 640px; }
.mark { font-weight: 650; font-size: 92px; letter-spacing: -0.035em; display: flex; align-items: center; gap: 22px; }
.tag { letter-spacing: -0.02em; }
.mark span { color: ${HONEY_TEXT}; }
.tag { font-size: 40px; line-height: 1.25; margin-top: 28px; }
.small { font-size: 26px; color: #646A85; margin-top: 40px; }
.right { flex: 1; position: relative; overflow: hidden; }
.right svg { position: absolute; top: 0; left: 0; }
</style></head><body>
<div class="left"><div class="mark"><svg width="84" height="60" viewBox="0 0 28 20"><path d="M4 15 C 9 14, 12 10, 14 9 S 20 5, 24 4" fill="none" stroke="${HONEY_TEXT}" stroke-width="2.2" stroke-linecap="round"/><circle cx="4" cy="15" r="3" fill="${HONEY_FILL}"/><circle cx="14" cy="9" r="3" fill="${HONEY_FILL}"/><circle cx="24" cy="4" r="3" fill="${HONEY_FILL}"/></svg><div>baby<span>trails</span></div></div>
<div class="tag">Your baby's growth records, private and in one place.</div>
<div class="small">WHO growth charts, encrypted on your device.<br>Free and open source.</div></div>
<div class="right"><svg width="560" height="630" viewBox="0 0 560 630">
  <path d="M40 560 C 180 420, 300 300, 520 150 L 520 330 C 330 430, 200 500, 40 600 Z" fill="${INK}" opacity="0.07"/>
  <path d="M40 585 C 190 470, 310 370, 520 240" stroke="${INK}" stroke-opacity="0.5" stroke-width="3" stroke-dasharray="10 8" fill="none"/>
  <path d="M60 560 L150 500 L240 440 L330 385 L420 330" stroke="${HONEY_TEXT}" stroke-width="6" fill="none"/>
  ${[[60, 560], [150, 500], [240, 440], [330, 385], [420, 330]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="16" fill="${HONEY_FILL}" stroke="${INK}" stroke-width="4"/>`).join('')}
</svg></div></body></html>`

mkdirSync(join(root, 'public/icons'), { recursive: true })
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' })
const page = await browser.newPage({ deviceScaleFactor: 1 })
const shots = [
  ['public/icons/icon-192.png', icon(192, 0, false), 192],
  ['public/icons/icon-512.png', icon(512, 0, false), 512],
  ['public/icons/maskable-512.png', icon(512, 0.2, false), 512],
  ['public/icons/apple-touch-icon.png', icon(180, 0.06, false), 180],
]
for (const [file, svg, size] of shots) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`)
  await page.screenshot({ path: join(root, file), omitBackground: false })
}
await page.setViewportSize({ width: 1200, height: 630 })
await page.setContent(og)
await page.evaluate(() => document.fonts.ready)
await page.screenshot({ path: join(root, 'public/og.png') })
await browser.close()
console.log('Icons and Open Graph image written to public/')
