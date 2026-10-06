// Writes a small, fictional "growth report" PDF for tests and the demo. Everything in it is made up.
// Hand-written PDF: one page, Helvetica, WinAnsi encoding (so Portuguese accents work).

import { writeFileSync } from 'node:fs'

const lines = [
  [18, 'Boletim de Saúde Infantil e Juvenil (exemplo fictício)'],
  [11, 'Documento de demonstração. Dados inventados.'],
  [12, ''],
  [12, 'Nome: Robin Exemplo        Data de nascimento: 15/03/2026'],
  [12, ''],
  [13, 'Avaliação do crescimento'],
  [12, 'Data          Peso        Comprimento     Perímetro cefálico'],
  [12, '15/07/2026    6,05 kg     60,3 cm         39,7 cm'],
  [12, '14/08/2026    6,60 kg     62,5 cm         40,8 cm'],
  [12, '15/09/2026    7,10 kg     64,3 cm         41,6 cm'],
  [12, ''],
  [12, 'Observações: crescimento a acompanhar na próxima consulta.'],
  [12, 'Próxima consulta: aos 9 meses.'],
]

// WinAnsi bytes for the text, with PDF string escaping.
const enc = (s) =>
  [...s]
    .map((ch) => {
      const code = ch.charCodeAt(0)
      if (ch === '(' || ch === ')' || ch === '\\') return '\\' + ch
      if (code < 128) return ch
      return '\\' + code.toString(8).padStart(3, '0') // Latin-1 range matches WinAnsi for these accents
    })
    .join('')

let y = 790
const content = lines
  .map(([size, text]) => {
    const out = `BT /F1 ${size} Tf 50 ${y} Td (${enc(text)}) Tj ET`
    y -= size + 10
    return out
  })
  .join('\n')

const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
]

let pdf = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'
const offsets = []
objects.forEach((obj, i) => {
  offsets.push(Buffer.byteLength(pdf, 'latin1'))
  pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`
})
const xref = Buffer.byteLength(pdf, 'latin1')
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`

writeFileSync(new URL('../tests/fixtures/sample-growth-report.pdf', import.meta.url), Buffer.from(pdf, 'latin1'))
console.log('Wrote tests/fixtures/sample-growth-report.pdf')
