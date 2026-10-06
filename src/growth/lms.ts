// WHO's LMS method (WHO Child Growth Standards: Methods and development, 2006, chapter 7,
// pp. 301–304). The code computes every number; nothing here comes from the AI.

export type Lms = { L: number; M: number; S: number }

// The measurement at k standard deviations: M·(1 + L·S·k)^(1/L).
export function valueAtZ({ L, M, S }: Lms, k: number): number {
  if (L === 0) return M * Math.exp(S * k)
  return M * Math.pow(1 + L * S * k, 1 / L)
}

export function rawZ(y: number, { L, M, S }: Lms): number {
  if (L === 0) return Math.log(y / M) / S
  return (Math.pow(y / M, L) - 1) / (L * S)
}

// WHO's "restricted application" for weight-based indicators: beyond ±3 SD the distance is measured
// in units of the gap between the 2 and 3 SD lines, because the LMS curve's tail stretches too far.
export function adjustedZ(y: number, lms: Lms): number {
  const z = rawZ(y, lms)
  if (z > 3) {
    const sd3 = valueAtZ(lms, 3)
    return 3 + (y - sd3) / (sd3 - valueAtZ(lms, 2))
  }
  if (z < -3) {
    const sd3 = valueAtZ(lms, -3)
    return -3 + (y - sd3) / (valueAtZ(lms, -2) - sd3)
  }
  return z
}

// The inverse of adjustedZ: the weight at a z-score, with the same rule beyond ±3 SD.
export function valueAtAdjustedZ(lms: Lms, z: number): number {
  if (z > 3) {
    const sd3 = valueAtZ(lms, 3)
    return sd3 + (z - 3) * (sd3 - valueAtZ(lms, 2))
  }
  if (z < -3) {
    const sd3 = valueAtZ(lms, -3)
    return sd3 + (z + 3) * (valueAtZ(lms, -2) - sd3)
  }
  return valueAtZ(lms, z)
}

// WHO's anthro software reports z-scores to 2 decimals.
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// The standard normal cumulative distribution, Φ(z), via the error function (Abramowitz and Stegun
// 7.1.26, accurate to about 1.5e-7, far below what a percentile shows).
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  const erf = 1 - poly * Math.exp(-x * x)
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf)
}

export function percentile(z: number): number {
  return normalCdf(z) * 100
}

// How a percentile is written: "52nd", "below the 0.1st", "above the 99.9th".
export function formatPercentile(z: number): string {
  return formatPercentileValue(percentile(z))
}

// The same, from a percentile rather than a z-score.
export function formatPercentileValue(p: number): string {
  if (p < 0.1) return 'below the 0.1st'
  if (p > 99.9) return 'above the 99.9th'
  if (p < 1 || p > 99) return ordinal(Math.round(p * 10) / 10)
  return ordinal(Math.round(p))
}

function ordinal(n: number): string {
  if (!Number.isInteger(n)) return `${n}th`
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}
