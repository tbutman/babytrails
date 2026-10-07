// Turns the report's SVG into files: a PNG, and a one-page PDF that embeds it as a JPEG. Everything
// happens in the browser; the report is a file the user shares, never a link to a server.

export const REPORT_W = 1080
export const REPORT_H = 1350

export type PageSize = { w: number; h: number }
const SIMPLE: PageSize = { w: REPORT_W, h: REPORT_H }

async function svgToCanvas(svg: string, size: PageSize, scale = 1): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = size.w * scale
    canvas.height = size.h * scale
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fffbf2'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), type, quality))

export async function reportPng(svg: string, size: PageSize = SIMPLE): Promise<Blob> {
  return toBlob(await svgToCanvas(svg, size), 'image/png')
}

// A minimal, valid PDF: one A4 page with the report as a JPEG image (DCTDecode), centered and as large
// as the margins allow.
export async function reportPdf(svg: string, size: PageSize = SIMPLE): Promise<Blob> {
  const canvas = await svgToCanvas(svg, size, size.w > 1100 ? 1.5 : 2)
  const jpeg = new Uint8Array(await (await toBlob(canvas, 'image/jpeg', 0.92)).arrayBuffer())
  const pageW = 595.28
  const pageH = 841.89
  const margin = 36
  const fit = Math.min((pageW - margin * 2) / size.w, (pageH - margin * 2) / size.h)
  const drawW = size.w * fit
  const drawH = size.h * fit
  const x = (pageW - drawW) / 2
  const y = (pageH - drawH) / 2
  const content = `q ${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`

  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const push = (p: Uint8Array | string) => {
    const bytes = typeof p === 'string' ? enc.encode(p) : p
    parts.push(bytes)
    length += bytes.length
  }
  const obj = (n: number, body: (string | Uint8Array)[]) => {
    offsets[n] = length
    push(`${n} 0 obj\n`)
    body.forEach(push)
    push('\nendobj\n')
  }

  push('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')
  obj(1, ['<< /Type /Catalog /Pages 2 0 R >>'])
  obj(2, ['<< /Type /Pages /Kids [3 0 R] /Count 1 >>'])
  obj(3, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`])
  obj(4, [
    `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    jpeg,
    '\nendstream',
  ])
  obj(5, [`<< /Length ${content.length} >>\nstream\n${content}\nendstream`])
  const xref = length
  push(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`)
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return new Blob(parts as BlobPart[], { type: 'application/pdf' })
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// Shares a file with the Web Share API where the browser supports sharing files.
export async function shareFile(blob: Blob, name: string, title: string): Promise<'shared' | 'unsupported' | 'cancelled'> {
  const file = new File([blob], name, { type: blob.type })
  if (!navigator.canShare?.({ files: [file] })) return 'unsupported'
  try {
    await navigator.share({ files: [file], title })
    return 'shared'
  } catch {
    return 'cancelled'
  }
}
