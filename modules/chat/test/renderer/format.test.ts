import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

/** Imports the formatters with every `Intl` formatter constructed for a Turkish system locale by default. */
async function formattersUnderTurkishSystemLocale() {
  const { NumberFormat, DateTimeFormat } = Intl
  const locales: unknown[] = []
  vi.spyOn(Intl, 'NumberFormat').mockImplementation(((l?: string, o?: Intl.NumberFormatOptions) => {
    locales.push(l)
    return new NumberFormat(l ?? 'tr-TR', o)
  }) as unknown as typeof Intl.NumberFormat)
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(((l?: string, o?: Intl.DateTimeFormatOptions) => {
    locales.push(l)
    return new DateTimeFormat(l ?? 'tr-TR', o)
  }) as unknown as typeof Intl.DateTimeFormat)
  const format = await import('../../src/renderer/kit/parts/lib/format')
  return { format, locales }
}

describe('kit number formatting', () => {
  it('uses the app locale (English), not the system locale', async () => {
    const { format, locales } = await formattersUnderTurkishSystemLocale()
    expect(format.formatTokens(18_400)).toBe('18.4K')
    expect(format.formatTokens(1000)).toBe('1K')
    expect(format.formatCount(48_000)).toBe('48,000')
    expect(format.formatUsd(0.0123)).toBe('$0.0123')
    expect(format.formatSeconds(2500)).toBe('2.5')
    expect(locales.every((l) => l === 'en-US')).toBe(true)
  })
})
