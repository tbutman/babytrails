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

// Centimetres (or inches) per month between two lengths or head circumferences.
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
