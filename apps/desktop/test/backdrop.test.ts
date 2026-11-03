import { PALETTE_IDS } from '@pragma/sdk'
import { describe, expect, it } from 'vitest'
import { backdropFor, wantsVibrancy } from '../src/backdrop'

describe('backdrop', () => {
  it.each([
    ['darwin', 'native'],
    ['linux', 'css'],
    ['win32', 'css'],
  ])('%s gets the %s backdrop', (platform, backdrop) => {
    expect(backdropFor(platform)).toBe(backdrop)
  })

  it('only the glass palette asks for vibrancy, only on macOS, never under reduced transparency', () => {
    expect(PALETTE_IDS.filter((p) => wantsVibrancy('darwin', p, false))).toEqual(['glass'])
    expect(wantsVibrancy('darwin', 'glass', true)).toBe(false)
    expect(wantsVibrancy('linux', 'glass', false)).toBe(false)
  })
})
