// Unit conversion and display. Values are always stored in metric.

export type Units = 'metric' | 'imperial'

export const KG_PER_LB = 0.45359237
export const CM_PER_IN = 2.54

export function kgToLbOz(kg: number): { lb: number; oz: number } {
  const totalOz = Math.round((kg / KG_PER_LB) * 16 * 10) / 10
  const lb = Math.floor(totalOz / 16)
  return { lb, oz: Math.round((totalOz - lb * 16) * 10) / 10 }
}

export function lbOzToKg(lb: number, oz: number): number {
  return (lb + oz / 16) * KG_PER_LB
}

export const cmToIn = (cm: number) => cm / CM_PER_IN
export const inToCm = (inches: number) => inches * CM_PER_IN

export function formatWeight(kg: number, units: Units): string {
  if (units === 'metric') return `${kg.toFixed(kg < 10 ? 2 : 1)} kg`
  const { lb, oz } = kgToLbOz(kg)
  return `${lb} lb ${oz} oz`
}

export function formatLength(cm: number, units: Units): string {
  return units === 'metric' ? `${cm.toFixed(1)} cm` : `${cmToIn(cm).toFixed(1)} in`
}

// Grams (or ounces) per week between two weights.
export function formatWeeklyGain(kgPerWeek: number, units: Units): string {
  const sign = kgPerWeek < 0 ? '−' : ''
  return units === 'metric'
    ? `${sign}${Math.round(Math.abs(kgPerWeek) * 1000)} g a week`
    : `${sign}${(Math.abs(kgPerWeek) / KG_PER_LB * 16).toFixed(1)} oz a week`
}

// Centimeters (or inches) per month between two lengths or head circumferences.
export function formatMonthlyGain(cmPerMonth: number, units: Units): string {
  const sign = cmPerMonth < 0 ? '−' : ''
  return units === 'metric' ? `${sign}${Math.abs(cmPerMonth).toFixed(1)} cm a month` : `${sign}${cmToIn(Math.abs(cmPerMonth)).toFixed(2)} in a month`
}

// Parses what people type on a phone: "7,9" and "7.9" both mean 7.9.
export function parseDecimal(text: string): number | undefined {
  const cleaned = text.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return undefined
  return Number(cleaned)
}

/**
 * A number with an optional unit after it, in the field's own unit (BABY-04): "6.1 kg", "6100 g" and
 * "6,1" in a kilograms field all give 6.1. `factors` says what each accepted unit is worth in the
 * field's unit. Returns undefined for anything else, so the form can say it isn't a number.
 */
export function parseAmount(text: string, factors: Record<string, number>): number | undefined {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*([a-zA-Z"']*)\.?\s*$/.exec(text)
  if (!m) return undefined
  const value = Number(m[1].replace(',', '.'))
  if (!m[2]) return value
  const factor = factors[m[2].toLowerCase()]
  return factor === undefined ? undefined : value * factor
}

export const KG_FIELD = { kg: 1, kgs: 1, g: 0.001, gr: 0.001 }
export const CM_FIELD = { cm: 1, mm: 0.1, in: CM_PER_IN, '"': CM_PER_IN }
export const IN_FIELD = { in: 1, '"': 1, cm: 1 / CM_PER_IN }
export const LB_FIELD = { lb: 1, lbs: 1 }
export const OZ_FIELD = { oz: 1 }
