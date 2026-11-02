import { describe, expect, it } from 'vitest'
import { ViewBackground } from '../src/main/theme/viewBackground'

function setup() {
  let tokens: Record<string, string> = { bg: '#1e1e1e' }
  const cbs = new Set<() => void>()
  const views: { colors: string[]; setBackgroundColor(c: string): void }[] = []
  const add = () => {
    const v = { colors: [] as string[], setBackgroundColor: (c: string) => void v.colors.push(c) }
    views.push(v)
    return v
  }
  const bg = new ViewBackground({
    theme: {
      get: () => ({ tokens }) as never,
      onChange: (cb) => {
        cbs.add(cb as () => void)
        return { dispose: () => cbs.delete(cb as () => void) }
      },
    },
    views: () => views,
  })
  const change = (t: Record<string, string>) => {
    tokens = t
    for (const cb of cbs) cb()
  }
  return { bg, add, change, cbs }
}

describe('ViewBackground', () => {
  it('paints a new view in the app background before it loads (no white or stale flash)', () => {
    const t = setup()
    const v = t.add()
    t.bg.apply(v)
    expect(v.colors).toEqual(['#1e1e1e'])
  })

  it('repaints every live view, hidden ones too, on a theme change', () => {
    const t = setup()
    const a = t.add()
    const b = t.add()
    const stop = t.bg.start()
    t.change({ bg: '#ffffff' })
    expect(a.colors).toEqual(['#ffffff'])
    expect(b.colors).toEqual(['#ffffff'])
    stop()
    expect(t.cbs.size).toBe(0)
  })

  it('skips a theme without a background token', () => {
    const t = setup()
    const v = t.add()
    t.change({})
    t.bg.apply(v)
    expect(v.colors).toEqual([])
  })
})
