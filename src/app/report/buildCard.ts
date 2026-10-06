// The report card as an SVG string, in two layouts: a phone-shaped image (1080 × 1920) for
// messaging apps, and an A4 page (1240 × 1754, about 150 dpi) for the PDF. Both are drawn from the
// same CardData and the app's own charts, always in the light theme.

import type { CardBar, CardData, CardRow, CardTile } from './cardData'
import { escapeXml, HONEY, HONEY_TEXT, INK, loadFont, MUTED } from './buildReport'

export type CardLayout = 'phone' | 'a4'
export const CARD_SIZE: Record<CardLayout, { w: number; h: number }> = { phone: { w: 1080, h: 1920 }, a4: { w: 1240, h: 1754 } }

const FONT = `font-family="Inter, Helvetica, Arial, sans-serif"`
const DISPLAY = `${FONT} font-weight="700" letter-spacing="-0.02em"`
const LINE = '#e4dfd2'
const PAPER = '#fffbf2'
const TINT = '#fcf2dc'
const CHART_W = 360
const CHART_H = 240

const t = (x: number, y: number, size: number, fill: string, text: string, extra = '') => `<text x="${x}" y="${y}" ${FONT} font-size="${size}" fill="${fill}" ${extra}>${escapeXml(text)}</text>`

/** Splits text into lines of about `width` pixels at `size`, by words. Inter averages about 0.5 em. */
export function wrap(text: string, width: number, size: number, maxLines: number): string[] {
  const perLine = Math.max(8, Math.floor(width / (size * 0.5)))
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if ((line ? line.length + 1 : 0) + word.length > perLine && line) {
      lines.push(line)
      line = word
    } else line = line ? `${line} ${word}` : word
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[\s,.;:]+\S*$/, '')}…`
    return kept
  }
  return lines
}

function header(d: CardData, pad: number, w: number, s: number): string {
  return `<rect width="${w}" height="${Math.round(272 * s)}" fill="${TINT}"/>
<text x="${pad}" y="${Math.round(96 * s)}" ${DISPLAY} font-size="${Math.round(34 * s)}" fill="${INK}">baby<tspan fill="${HONEY_TEXT}">trails</tspan></text>
${t(w - pad, Math.round(96 * s), Math.round(22 * s), MUTED, d.generatedOn, 'text-anchor="end"')}
<text x="${pad}" y="${Math.round(184 * s)}" ${DISPLAY} font-size="${Math.round(64 * s)}" fill="${INK}">${escapeXml(d.title)}</text>
${t(pad, Math.round(238 * s), Math.round(28 * s), MUTED, d.subtitle)}`
}

function tiles(list: CardTile[], x: number, y: number, w: number, h: number): string {
  const gap = 20
  const tw = (w - gap * (list.length - 1)) / list.length
  return list
    .map((tile, i) => {
      const tx = x + i * (tw + gap)
      return `<g transform="translate(${tx} ${y})">
<rect width="${tw}" height="${h}" rx="20" fill="#ffffff" stroke="${LINE}" stroke-width="2"/>
${t(24, 38, 22, MUTED, tile.label)}
<text x="24" y="82" ${DISPLAY} font-size="40" fill="${INK}">${escapeXml(tile.value)}</text>
${tile.percentile ? `<rect x="22" y="100" width="${tile.percentile.length * 10.6 + 24}" height="30" rx="15" fill="${TINT}"/>${t(34, 121, 19, HONEY_TEXT, tile.percentile, 'font-weight="600"')}` : ''}
${tile.change ? t(24, h - 10, 18, MUTED, tile.change) : ''}
</g>`
    })
    .join('\n')
}

function chartCell(title: string, svg: string | undefined, x: number, y: number, w: number): string {
  const h = (w * CHART_H) / CHART_W
  const chart = svg ? svg.replace('<svg', `<svg x="${x}" y="${y + 36}" width="${w}" height="${h}"`) : ''
  return `${t(x, y + 22, 22, INK, title, 'font-weight="650"')}\n${chart}`
}

function bars(list: CardBar[], x: number, y: number, w: number, h: number): string {
  if (list.length < 2) return ''
  const labelH = 22
  const values = list.flatMap((b) => [b.rate, b.sameLine ?? 0, 0])
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const yv = (v: number) => y + ((max - v) / span) * (h - labelH)
  const slot = w / list.length
  const bw = Math.min(36, slot * 0.58)
  const out = [`<line x1="${x}" x2="${x + w}" y1="${yv(0)}" y2="${yv(0)}" stroke="rgb(29 35 64 / 0.3)" stroke-width="1.5"/>`]
  list.forEach((b, i) => {
    const cx = x + slot * i + slot / 2
    const top = Math.min(yv(0), yv(b.rate))
    const height = Math.max(2, Math.abs(yv(b.rate) - yv(0)))
    out.push(
      b.short
        ? `<rect x="${cx - bw / 2}" y="${top}" width="${bw}" height="${height}" rx="4" fill="${TINT}" stroke="${HONEY}" stroke-width="2" stroke-dasharray="4 3"/>`
        : `<rect x="${cx - bw / 2}" y="${top}" width="${bw}" height="${height}" rx="4" fill="${HONEY}"/>`,
    )
    if (b.sameLine !== undefined) out.push(`<line x1="${cx - bw / 2 - 5}" x2="${cx + bw / 2 + 5}" y1="${yv(b.sameLine)}" y2="${yv(b.sameLine)}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`)
    out.push(t(cx, y + h, 15, MUTED, b.label, 'text-anchor="middle"'))
  })
  return out.join('\n')
}

function gainBlock(d: CardData, x: number, y: number, w: number, h: number): string {
  if (!d.gain) return ''
  const g = d.gain
  const sentence = g.sentence ? wrap(g.sentence, w, 19, 2) : []
  const barsTop = y + 76 + sentence.length * 26 + 8
  return `${t(x, y + 24, 24, INK, 'Gain over time', 'font-weight="700"')}
<text x="${x}" y="${y + 62}" ${DISPLAY} font-size="30" fill="${INK}">${escapeXml(g.headline)}</text>
${sentence.map((l, i) => t(x, y + 92 + i * 26, 19, MUTED, l)).join('\n')}
${bars(g.bars, x, barsTop, w, y + h - barsTop)}`
}

function highlightsBlock(lines: string[], x: number, y: number, w: number, maxLines: number): string {
  const out = [t(x, y + 24, 24, INK, 'Highlights', 'font-weight="700"')]
  let cy = y + 64
  let used = 0
  for (const h of lines) {
    const wrapped = wrap(h, w - 28, 21, Math.max(1, maxLines - used))
    if (used >= maxLines) break
    out.push(`<circle cx="${x + 7}" cy="${cy - 7}" r="6" fill="${HONEY}" stroke="${INK}" stroke-width="1.5"/>`)
    wrapped.forEach((l, i) => out.push(t(x + 24, cy + i * 28, 21, INK, l)))
    cy += wrapped.length * 28 + 10
    used += wrapped.length
  }
  return out.join('\n')
}

function historyBlock(rows: CardRow[], x: number, y: number, w: number, maxRows: number, head: boolean): string {
  const cols: [keyof CardRow, string, number][] = [
    ['date', 'Date', 0],
    ['age', 'Age', 0.27],
    ['weight', 'Weight', 0.5],
    ['length', 'Length', 0.68],
    ...(head ? [['head', 'Head', 0.85] as [keyof CardRow, string, number]] : []),
  ]
  const out = [t(x, y + 24, 24, INK, 'History', 'font-weight="700"')]
  const headY = y + 62
  cols.forEach(([, label, f]) => out.push(t(x + f * w, headY, 17, MUTED, label, 'font-weight="600"')))
  out.push(`<line x1="${x}" x2="${x + w}" y1="${headY + 10}" y2="${headY + 10}" stroke="${LINE}" stroke-width="2"/>`)
  rows.slice(0, maxRows).forEach((r, i) => {
    const ry = headY + 42 + i * 34
    cols.forEach(([key, , f]) => out.push(t(x + f * w, ry, 19, INK, r[key] || '—')))
  })
  if (rows.length > maxRows) out.push(t(x, headY + 42 + maxRows * 34, 16, MUTED, `and ${rows.length - maxRows} earlier`))
  return out.join('\n')
}

function aiBlock(ai: NonNullable<CardData['ai']>, x: number, y: number, w: number, maxLines: number): string {
  const lines = wrap(ai.text, w, 20, maxLines)
  return `${t(x, y + 20, 17, HONEY_TEXT, ai.label, 'font-weight="600"')}
${lines.map((l, i) => t(x, y + 52 + i * 28, 20, INK, l)).join('\n')}`
}

const historyHeight = (rows: number, more: boolean) => 62 + 42 + (rows - 1) * 34 + (more ? 34 : 12)
const aiHeight = (lines: number) => 52 + (lines - 1) * 28 + 14

export async function buildCard(d: CardData, charts: Partial<Record<string, string>>, layout: CardLayout): Promise<string> {
  const font = await loadFont()
  const { w, h } = CARD_SIZE[layout]
  const pad = layout === 'phone' ? 64 : 72
  const inner = w - pad * 2
  const s = layout === 'phone' ? 1 : 0.92
  const parts: string[] = [header(d, pad, w, s)]

  // Latest numbers.
  let y = Math.round(300 * s)
  const tileH = 176
  parts.push(tiles(d.tiles, pad, y, inner, tileH))
  y += tileH + 32

  // Charts, two to a row. On A4 they're a little narrower than the column, to leave room below.
  const gap = 24
  const cellW = (inner - gap) / 2
  const chartW = layout === 'a4' ? 430 : cellW
  const cellH = 36 + (chartW * CHART_H) / CHART_W
  d.charts.forEach((c, i) => parts.push(chartCell(c.title, charts[c.choice], pad + (i % 2) * (cellW + gap), y + Math.floor(i / 2) * (cellH + 16), chartW)))
  y += Math.ceil(d.charts.length / 2) * (cellH + 16) + 20

  const footerY = h - 70
  const historyRows = (room: number) => (room < historyHeight(1, false) ? 0 : Math.floor((room - 62 - 42 - 46) / 34) + 1)
  const head = !!d.history?.some((r) => r.head)
  const rowH = 236

  if (layout === 'phone') {
    // Gain over time beside the highlights, then the history and the AI paragraph across the page.
    if (d.gain) parts.push(gainBlock(d, pad, y, cellW, rowH))
    parts.push(highlightsBlock(d.highlights, d.gain ? pad + cellW + gap : pad, y, d.gain ? cellW : inner, 6))
    y += rowH + 24
    const aiLines = d.ai ? wrap(d.ai.text, inner, 20, 3).length : 0
    const aiH = d.ai ? aiHeight(aiLines) : 0
    if (d.history?.length) {
      const rows = Math.min(d.history.length, historyRows(footerY - 20 - y - aiH))
      if (rows > 0) {
        parts.push(historyBlock(d.history, pad, y, inner, rows, head))
        y += historyHeight(rows, d.history.length > rows) + 16
      }
    }
    const room = footerY - 20 - y
    if (d.ai && room >= aiHeight(1)) parts.push(aiBlock(d.ai, pad, y, inner, Math.min(aiLines, Math.floor((room - 52 - 14) / 28) + 1)))
  } else {
    // Two columns: gain over time and the history on the left, highlights and the AI paragraph on the right.
    const right = pad + cellW + gap
    let left = y
    if (d.gain) {
      parts.push(gainBlock(d, pad, left, cellW, rowH))
      left += rowH + 24
    }
    if (d.history?.length) {
      const rows = Math.min(d.history.length, historyRows(footerY - 20 - left))
      if (rows > 0) parts.push(historyBlock(d.history, pad, left, cellW, rows, head))
    }
    const highlightLines = 6
    parts.push(highlightsBlock(d.highlights, right, y, cellW, highlightLines))
    const used = 64 + Math.min(highlightLines, d.highlights.reduce((n, l) => n + wrap(l, cellW - 28, 21, highlightLines).length, 0)) * 28 + d.highlights.length * 10
    const aiTop = y + used + 16
    const room = footerY - 20 - aiTop
    if (d.ai && room >= aiHeight(1)) parts.push(aiBlock(d.ai, right, aiTop, cellW, Math.min(8, Math.floor((room - 52 - 14) / 28) + 1)))
  }

  // Footer.
  parts.push(`<line x1="${pad}" x2="${w - pad}" y1="${footerY}" y2="${footerY}" stroke="${LINE}" stroke-width="2"/>`)
  parts.push(t(pad, footerY + 36, 18, MUTED, 'WHO Child Growth Standards · A record, not medical advice'))
  parts.push(t(w - pad, footerY + 36, 18, HONEY_TEXT, 'babytrails.app', 'text-anchor="end" font-weight="600"'))

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<style>@font-face { font-family: Inter; font-weight: 100 900; src: url(${font}) format('woff2'); }</style>
<rect width="100%" height="100%" fill="${PAPER}"/>
${parts.join('\n')}
</svg>`
}
