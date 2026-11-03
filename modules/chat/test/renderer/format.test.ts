import { afterEach, describe, expect, it, vi } from 'vitest'

const original = { NumberFormat: Intl.NumberFormat, DateTimeFormat: Intl.DateTimeFormat }

afterEach(() => {
  Object.assign(Intl, original)
  vi.resetModules()
})

/** Imports the formatters while every `Intl` formatter defaults to a Turkish system locale. */
async function formattersUnderTurkishSystemLocale() {
  const locales: unknown[] = []
  class TurkishNumbers extends original.NumberFormat {
    constructor(l?: string, o?: Intl.NumberFormatOptions) {
      locales.push(l)
      super(l ?? 'tr-TR', o)
    }
  }
  class TurkishDates extends original.DateTimeFormat {
    constructor(l?: string, o?: Intl.DateTimeFormatOptions) {
      locales.push(l)
      super(l ?? 'tr-TR', o)
    }
  }
  Object.assign(Intl, { NumberFormat: TurkishNumbers, DateTimeFormat: TurkishDates })
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
    expect(locales.length).toBeGreaterThan(0)
    expect(locales.every((l) => l === 'en-US')).toBe(true)
  })
})
