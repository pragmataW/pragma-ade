import { icons } from '@pragma/ui/icons'
import { toPascalCase } from '@pragma/ui/lib/utils'
import { describe, expect, it } from 'vitest'
import { ICONS } from '../../src/constants'

describe('agents icons', () => {
  it.each(Object.entries(ICONS))('%s → "%s" is a known lucide icon (no CircleHelp fallback)', (_key, name) => {
    expect(Object.hasOwn(icons, toPascalCase(name))).toBe(true)
  })
})
