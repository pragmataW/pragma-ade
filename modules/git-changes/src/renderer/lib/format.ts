const UNITS = ['B', 'KB', 'MB', 'GB'] as const
const STEP = 1024
const LOCALE = 'en'
const SPACE = ' '
const number = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 })

/** `1258291` → `1.2 MB`, `1048576` → `1 MB` (binary multiples, one decimal at most). */
export function formatBytes(n: number): string {
  let value = n
  let unit = 0
  while (value >= STEP && unit < UNITS.length - 1) {
    value /= STEP
    unit += 1
  }
  return `${number.format(value)}${SPACE}${UNITS[unit]}`
}
