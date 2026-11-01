import { BrowserElementContextSchema } from '@pragma/module-comments/contract'
import { expect, it } from 'vitest'
import { toElementContext } from '../../src/renderer/lib/element-context'
import { buildPick } from '../lib/builders'

it.each([
  [true, true, ['screenshotPath', 'styles', 'consoleErrors']],
  [true, false, ['consoleErrors']],
  [false, true, ['screenshotPath', 'styles']],
  [false, false, []],
])('console=%s shot=%s', (includeConsoleErrors, includeScreenshotAndStyles, present) => {
  const ctx = toElementContext(buildPick(), { includeConsoleErrors, includeScreenshotAndStyles })
  expect(BrowserElementContextSchema.parse(ctx)).toEqual(ctx)
  for (const key of ['screenshotPath', 'styles', 'consoleErrors'])
    expect(Object.hasOwn(ctx, key)).toBe(present.includes(key))
  expect(ctx).toMatchObject({ url: 'http://localhost:3000/', selector: '#save', boundingBox: buildPick().rect })
})

it('omits empty console errors, a missing screenshot and a missing component', () => {
  const ctx = toElementContext(buildPick({ consoleErrors: [], screenshotPath: null }), {
    includeConsoleErrors: true,
    includeScreenshotAndStyles: true,
  })
  expect(Object.keys(ctx).sort()).toEqual(['boundingBox', 'outerHtml', 'selector', 'styles', 'text', 'url'])
})

it('carries the component', () =>
  expect(
    toElementContext(buildPick({ component: { name: 'Save', source: 'src/Save.tsx:1:2' } }), {
      includeConsoleErrors: false,
      includeScreenshotAndStyles: false,
    }).component,
  ).toEqual({ name: 'Save', source: 'src/Save.tsx:1:2' }))
