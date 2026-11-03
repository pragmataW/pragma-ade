import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { TabIndicator } from '../src/components/tab-indicator'
import { Tabs, TabsList, TabsTrigger } from '../src/components/tabs'
import { indicatorPlacement, samePlacement } from '../src/lib/tab-indicator'

const INDICATOR = 'indicator'

/** jsdom does no layout: tabs report the box given in `data-x` / `data-w`. */
const metric = (attr: 'x' | 'w') => ({
  configurable: true,
  get(this: HTMLElement) {
    return Number(this.dataset[attr] ?? 0)
  },
})
const METRICS = { offsetLeft: 'x', offsetWidth: 'w' } as const
const native = Object.keys(METRICS).map(
  (key) => [key, Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)] as const,
)
beforeAll(() => {
  for (const [key, attr] of Object.entries(METRICS)) Object.defineProperty(HTMLElement.prototype, key, metric(attr))
})
afterEach(cleanup)
afterAll(() => {
  for (const [key, descriptor] of native) if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor)
})

describe('indicatorPlacement', () => {
  it('spans the selected tab', () => {
    expect(indicatorPlacement({ offsetLeft: 40, offsetWidth: 32 })).toEqual({ x: 40, width: 32 })
  })
  it('is null without a tab or for a tab that is not laid out (hidden panel)', () => {
    expect(indicatorPlacement(null)).toBeNull()
    expect(indicatorPlacement({ offsetLeft: 0, offsetWidth: 0 })).toBeNull()
  })
  it('compares placements by value', () => {
    expect(samePlacement({ x: 1, width: 2 }, { x: 1, width: 2 })).toBe(true)
    expect(samePlacement({ x: 1, width: 2 }, { x: 1, width: 3 })).toBe(false)
    expect(samePlacement(null, null)).toBe(true)
    expect(samePlacement(null, { x: 0, width: 1 })).toBe(false)
  })
})

type Tab = { id: string; x: number; w: number }
function Strip({ tabs, selected }: { tabs: Tab[]; selected: string }) {
  return (
    <div role="tablist" className="relative">
      {tabs.map((tab) => (
        <button key={tab.id} type="button" role="tab" aria-selected={tab.id === selected} data-x={tab.x} data-w={tab.w}>
          {tab.id}
        </button>
      ))}
      <TabIndicator data-testid={INDICATOR} />
    </div>
  )
}

const A = { id: 'a', x: 0, w: 30 }
const B = { id: 'b', x: 30, w: 50 }
const C = { id: 'c', x: 80, w: 40 }
const indicator = () => screen.getByTestId(INDICATOR)
const expectAt = (x: number, width: number) =>
  waitFor(() => {
    expect(indicator().style.transform).toBe(`translateX(${x}px)`)
    expect(indicator().style.width).toBe(`${width}px`)
  })

describe('TabIndicator', () => {
  it('sits under the selected tab without sliding in, then slides when the selection moves', async () => {
    const r = render(<Strip tabs={[A, B, C]} selected="a" />)
    await expectAt(0, 30)
    expect(indicator().dataset.animate).toBe('false')
    expect(indicator()).toHaveAttribute('aria-hidden', 'true')
    r.rerender(<Strip tabs={[A, B, C]} selected="c" />)
    await expectAt(80, 40)
    expect(indicator().dataset.animate).toBe('true')
  })

  it('follows the selected tab when tabs are added, reordered or removed', async () => {
    const r = render(<Strip tabs={[A, B]} selected="b" />)
    await expectAt(30, 50)
    r.rerender(<Strip tabs={[A, { ...C, x: 30 }, { ...B, x: 70 }]} selected="b" />)
    await expectAt(70, 50)
    r.rerender(<Strip tabs={[{ ...B, x: 0 }]} selected="b" />)
    await expectAt(0, 50)
  })

  it('hides when no tab is selected, and snaps (no slide) when one comes back', async () => {
    const r = render(<Strip tabs={[A, B]} selected="a" />)
    await expectAt(0, 30)
    act(() => r.rerender(<Strip tabs={[A, B]} selected="none" />))
    await waitFor(() => expect(indicator().style.opacity).toBe('0'))
    r.rerender(<Strip tabs={[A, B]} selected="b" />)
    await expectAt(30, 50)
    expect(indicator().dataset.animate).toBe('false')
  })
})

it('the line variant of TabsList draws one sliding indicator; the default variant none', () => {
  const list = (variant: 'line' | 'default') => (
    <Tabs defaultValue="a">
      <TabsList variant={variant} data-testid={variant}>
        <TabsTrigger value="a">{'A'}</TabsTrigger>
        <TabsTrigger value="b">{'B'}</TabsTrigger>
      </TabsList>
    </Tabs>
  )
  render(
    <>
      {list('line')}
      {list('default')}
    </>,
  )
  expect(screen.getByTestId('line').querySelector(':scope > span[aria-hidden]')).not.toBeNull()
  expect(screen.getByTestId('default').querySelector(':scope > span[aria-hidden]')).toBeNull()
})
