// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { collectElementContext } from '../../src/main/picker/page/collect'
import { mount, OPTS, q } from '../lib/builders'

it('truncates outerHTML and text', () => {
  mount(`<div id="big">${'x'.repeat(10_000)}</div>`)
  const r = collectElementContext(q('#big'), OPTS)
  expect(r.outerHtml).toMatch(/…\[truncated \d+ chars\]$/)
  expect(r.outerHtml.length).toBeLessThan(OPTS.outerHtmlMax + 40)
  expect(r.text.length).toBeLessThan(OPTS.textMax + 40)
})

it('redacts password values', () => {
  mount(
    '<form><input type="password" value="hunter2"><input type="hidden" name="csrf" value="tok"><div data-auth-token="s3"></div></form>',
  )
  const r = collectElementContext(q('form'), OPTS)
  for (const secret of ['hunter2', 'tok', 's3']) expect(r.outerHtml).not.toContain(`="${secret}"`)
  expect(r.outerHtml).toContain('value="[redacted]"')
  expect(q<HTMLInputElement>('input').getAttribute('value')).toBe('hunter2')
})

it('collects exactly the requested styles and a finite rect', () => {
  mount('<button id="b" style="display:block;color:red">Go</button>')
  const r = collectElementContext(q('#b'), OPTS)
  expect(Object.keys(r.styles)).toEqual(OPTS.styleProps)
  expect(r.styles.display).toBe('block')
  for (const v of Object.values(r.rect)) expect(Number.isFinite(v)).toBe(true)
  expect(r).toMatchObject({ selector: '#b', tagName: 'button', text: 'Go', domPath: 'body > button#b' })
})
