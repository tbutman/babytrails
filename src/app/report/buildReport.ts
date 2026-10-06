// The one-page report as an SVG string: who (as the user chooses to show them), the latest
// measurements and percentiles, one WHO chart, the recent trend and a few highlights. Always drawn in
// the light theme so it prints and shares well.

import fontUrl from '@fontsource/quicksand/files/quicksand-latin-700-normal.woff2?url'
import { toBase64 } from '../../core/ai/client'
import { REPORT_H, REPORT_W } from './render'

export type ReportStat = { label: string; value: string; percentile?: string }

export type ReportData = {
  title: string // the name shown, or "Growth report"
  subtitle: string // age or date of birth, as chosen
  generatedOn: string
  stats: ReportStat[]
  trend?: string
  highlights: string[]
  chartTitle: string
  chartSvg: string // a serialised GrowthChart
}

const INK = '#1d2340'
const MUTED = '#646a85'
const HONEY = '#e0a21e'
const HONEY_TEXT = '#9a6400'

export const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!)

let fontData: Promise<string> | undefined
function loadFont() {
  fontData ??= fetch(fontUrl)
    .then((r) => r.arrayBuffer())
    .then((b) => `data:font/woff2;base64,${toBase64(new Uint8Array(b))}`)
  return fontData
}

// Chart styles are inlined because an SVG drawn as an image can't see the page's stylesheet.
const CHART_STYLES: Record<string, Record<string, string>> = {
  'chart-grid': { stroke: 'rgb(29 35 64 / 0.08)' },
  'chart-tick': { fill: MUTED, 'font-size': '10', 'font-family': 'Helvetica, Arial, sans-serif' },
  'chart-band-outer': { fill: 'rgb(29 35 64 / 0.07)' },
  'chart-band-inner': { fill: 'rgb(29 35 64 / 0.12)' },
  'chart-median': { fill: 'none', stroke: 'rgb(29 35 64 / 0.55)', 'stroke-width': '1', 'stroke-dasharray': '4 3' },
  'chart-child-line': { fill: 'none', stroke: HONEY_TEXT, 'stroke-width': '2' },
  'chart-child-point': { fill: HONEY, stroke: INK, 'stroke-width': '1.5' },
}

export function serialiseChart(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.querySelectorAll('[class]').forEach((el) => {
    for (const cls of el.getAttribute('class')!.split(/\s+/)) {
      for (const [k, v] of Object.entries(CHART_STYLES[cls] ?? {})) el.setAttribute(k, v)
    }
    el.removeAttribute('class')
  })
  clone.querySelectorAll('title').forEach((t) => t.remove())
  clone.removeAttribute('role')
  clone.removeAttribute('aria-label')
  return new XMLSerializer().serializeToString(clone)
}

export async function buildReport(d: ReportData): Promise<string> {
  const font = await loadFont()
  const pad = 72
  const display = `font-family="Quicksand, Helvetica, Arial, sans-serif" font-weight="700"`
  const body = `font-family="Helvetica, Arial, sans-serif"`
  const statW = (REPORT_W - pad * 2 - 24 * (d.stats.length - 1)) / Math.max(1, d.stats.length)

  const stats = d.stats
    .map((s, i) => {
      const x = pad + i * (statW + 24)
      return `<g transform="translate(${x} 300)">
  <rect width="${statW}" height="150" rx="20" fill="#ffffff" stroke="#e4dfd2" stroke-width="2"/>
  <text x="24" y="44" ${body} font-size="24" fill="${MUTED}">${escapeXml(s.label)}</text>
  <text x="24" y="92" ${display} font-size="40" fill="${INK}">${escapeXml(s.value)}</text>
  ${s.percentile ? `<text x="24" y="128" ${body} font-size="22" fill="${MUTED}">${escapeXml(s.percentile)}</text>` : ''}
</g>`
    })
    .join('\n')

  // The chart is nested at a fixed size; its own viewBox scales it.
  const chartH = 530
  const chartW = (chartH * 360) / 240
  const chart = d.chartSvg.replace('<svg', `<svg x="${(REPORT_W - chartW) / 2}" y="555" width="${chartW}" height="${chartH}"`)

  const highlights = d.highlights
    .slice(0, 3)
    .map((h, i) => `<text x="${pad + 28}" y="${1176 + i * 38}" ${body} font-size="25" fill="${INK}">${escapeXml(h)}</text><circle cx="${pad + 8}" cy="${1168 + i * 38}" r="6" fill="${HONEY}" stroke="${INK}" stroke-width="1.5"/>`)
    .join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${REPORT_W}" height="${REPORT_H}" viewBox="0 0 ${REPORT_W} ${REPORT_H}">
<style>@font-face { font-family: Quicksand; font-weight: 700; src: url(${font}) format('woff2'); }</style>
<rect width="100%" height="100%" fill="#fffbf2"/>
<text x="${pad}" y="104" ${display} font-size="34" fill="${INK}">baby<tspan fill="${HONEY_TEXT}">trails</tspan></text>
<text x="${REPORT_W - pad}" y="104" ${body} font-size="22" fill="${MUTED}" text-anchor="end">${escapeXml(d.generatedOn)}</text>
<text x="${pad}" y="196" ${display} font-size="60" fill="${INK}">${escapeXml(d.title)}</text>
<text x="${pad}" y="246" ${body} font-size="28" fill="${MUTED}">${escapeXml(d.subtitle)}</text>
${stats}
<text x="${pad}" y="530" ${display} font-size="32" fill="${INK}">${escapeXml(d.chartTitle)}</text>
${d.trend ? `<text x="${REPORT_W - pad}" y="530" ${body} font-size="24" fill="${HONEY_TEXT}" text-anchor="end">${escapeXml(d.trend)}</text>` : ''}
${chart}
<text x="${pad}" y="1120" ${display} font-size="28" fill="${INK}">Highlights</text>
${highlights}
<line x1="${pad}" x2="${REPORT_W - pad}" y1="1290" y2="1290" stroke="#e4dfd2" stroke-width="2"/>
<text x="${pad}" y="1322" ${body} font-size="19" fill="${MUTED}">WHO Child Growth Standards percentiles. A record, not medical advice. babytrails.app</text>
</svg>`
}
