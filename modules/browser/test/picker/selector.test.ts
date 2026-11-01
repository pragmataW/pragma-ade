// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { buildDomPath, buildSelector } from '../../src/main/picker/page/selector'
import { mount, NESTED_FIXTURE, q, SEL } from '../lib/builders'

it.each([
  ['<button id="save">x</button>', '#save', '#save'],
  [
    '<ul class="list"><li class="item">a</li><li class="item">b</li></ul>',
    'li:nth-child(2)',
    'ul.list > li.item:nth-of-type(2)',
  ],
  ['<main><span class="css-1a2b3c Xy12AbCdEfGh34 title">t</span></main>', 'span', 'span.title'],
])('selector for %s', (html, target, expected) => {
  mount(html)
  expect(buildSelector(q(target), SEL)).toBe(expected)
})

it('escapes awkward ids', () => {
  mount('<div id="a:b"></div><div id="1x"></div>')
  for (const el of document.querySelectorAll('div')) expect(document.querySelector(buildSelector(el, SEL))).toBe(el)
})

it('is unique for every element of a nested fixture', () => {
  mount(NESTED_FIXTURE)
  const all = [...document.body.querySelectorAll('*')]
  expect(all.length).toBeGreaterThan(35)
  for (const el of all) expect([...document.querySelectorAll(buildSelector(el, SEL))]).toEqual([el])
})

it('dom path is readable', () => {
  mount('<main><ul class="list"><li class="item">a</li></ul></main>')
  expect(buildDomPath(q('li'), SEL)).toBe('body > main > ul.list > li.item')
})

it('dom path is capped', () => {
  mount(`${'<div>'.repeat(12)}<b>x</b>${'</div>'.repeat(12)}`)
  expect(buildDomPath(q('b'), SEL).split(' > ')).toHaveLength(SEL.domPathMaxDepth)
})
