// Display helpers for ages and dates.

// "6 months, 18 days", "1 year, 2 months", "12 days": calendar months, then days.
export function formatAge(dateOfBirth: string, on: string): string {
  const [by, bm, bd] = dateOfBirth.split('-').map(Number)
  const [y, m, d] = on.split('-').map(Number)
  const target = Date.UTC(y, m - 1, d)
  if (target < Date.UTC(by, bm - 1, bd)) return 'before birth'
  // The birth date moved on by n months, clamped to the end of shorter months (31 Jan → 28 Feb).
  const monthsOn = (n: number) => {
    const last = new Date(Date.UTC(by, bm - 1 + n + 1, 0)).getUTCDate()
    return Date.UTC(by, bm - 1 + n, Math.min(bd, last))
  }
  let months = (y - by) * 12 + (m - bm)
  while (months > 0 && monthsOn(months) > target) months -= 1
  const days = Math.round((target - monthsOn(months)) / 86_400_000)
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  if (months === 0) return plural(days, 'day')
  if (months < 24) return days ? `${plural(months, 'month')}, ${plural(days, 'day')}` : plural(months, 'month')
  const years = Math.floor(months / 12)
  const rest = months % 12
  return rest ? `${plural(years, 'year')}, ${plural(rest, 'month')}` : plural(years, 'year')
}

export function formatDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
