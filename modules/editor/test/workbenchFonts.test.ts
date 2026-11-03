import { FONT_MONO, FONT_SANS } from '@pragma/ui/tokens'
import { describe, expect, it, vi } from 'vitest'
import { WORKBENCH_FONT_FILES } from '../src/main/views/fontAssets'
import { WORKBENCH_COMMENTS_CSS } from '../src/main/views/workbenchComments'
import {
  applyWorkbenchStyles,
  dataUrlBase64,
  type FontTarget,
  fontFaceScript,
  primaryFamily,
  workbenchFontCss,
} from '../src/main/views/workbenchFonts'

const WOFF2_MAGIC = 'wOF2'

function fakeTarget() {
  const listeners: (() => void)[] = []
  const wc = {
    on: vi.fn((_event: string, l: () => void) => listeners.push(l)),
    insertCSS: vi.fn(async (_css: string) => 'key'),
    executeJavaScript: vi.fn(async (_code: string) => undefined),
  } satisfies FontTarget
  const load = (): void => {
    for (const l of listeners) l()
  }
  return { wc, load }
}

describe('workbench fonts', () => {
  it('primaryFamily unquotes the first family of a stack', () => {
    expect(primaryFamily(FONT_SANS)).toBe('Inter Variable')
    expect(primaryFamily(FONT_MONO)).toBe('JetBrains Mono Variable')
    expect(primaryFamily('"A B", serif')).toBe('A B')
  })

  it('dataUrlBase64 strips the data URL header', () => {
    expect(dataUrlBase64('data:font/woff2;base64,d09GMg==')).toBe('d09GMg==')
  })

  it('css points the workbench font variables at the app stacks', () => {
    const css = workbenchFontCss()
    expect(css).toContain('.monaco-workbench')
    expect(css).toContain('.mac')
    expect(css).toContain(`--monaco-font: ${FONT_SANS} !important`)
    expect(css).toContain(`--monaco-monospace-font: ${FONT_MONO} !important`)
  })

  it('bundles latin and latin-ext woff2 for both fonts', () => {
    const families = WORKBENCH_FONT_FILES.map((f) => f.family)
    expect(families.filter((f) => f === 'Inter Variable')).toHaveLength(2)
    expect(families.filter((f) => f === 'JetBrains Mono Variable')).toHaveLength(2)
    for (const f of WORKBENCH_FONT_FILES)
      expect(Buffer.from(f.base64, 'base64').subarray(0, 4).toString()).toBe(WOFF2_MAGIC)
  })

  it('every page load inserts the font css and the extra sheets and adds the faces', async () => {
    const { wc, load } = fakeTarget()
    const files = [{ family: 'X', weight: '400', unicodeRange: 'U+0000-00FF', base64: 'AA==' }]
    applyWorkbenchStyles(wc, { fonts: files, sheets: ['.a { color: red }'] }, vi.fn())
    expect(wc.insertCSS).not.toHaveBeenCalled()
    load()
    load()
    expect(wc.insertCSS).toHaveBeenCalledTimes(4)
    expect(wc.insertCSS).toHaveBeenCalledWith(workbenchFontCss())
    expect(wc.insertCSS).toHaveBeenCalledWith('.a { color: red }')
    expect(wc.executeJavaScript).toHaveBeenCalledWith(fontFaceScript(files))
  })

  it('the comment widget skin wraps its buttons and takes every colour from the workbench theme', () => {
    expect(WORKBENCH_COMMENTS_CSS).toContain('.review-widget')
    expect(WORKBENCH_COMMENTS_CSS).toMatch(/flex-wrap:\s*wrap/)
    expect(WORKBENCH_COMMENTS_CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i)
    expect(WORKBENCH_COMMENTS_CSS).toContain('var(--vscode-pragma-comment-pendingBorder)')
  })

  it('a failed injection is logged, not thrown', async () => {
    const { wc, load } = fakeTarget()
    const err = new Error('gone')
    wc.insertCSS.mockRejectedValueOnce(err)
    const log = vi.fn()
    applyWorkbenchStyles(wc, { fonts: [], sheets: [] }, log)
    load()
    await vi.waitFor(() => expect(log).toHaveBeenCalledWith(expect.any(String), err))
  })
})
