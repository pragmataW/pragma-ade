import { afterEach } from 'vitest'

/** jsdom has no layout: a ResizeObserver that reports `width` for every observed element (set before render). */
export const resize = { width: 0 }
const original = globalThis.ResizeObserver

class FakeResizeObserver {
  private readonly cb: ResizeObserverCallback
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb
  }
  observe(target: Element): void {
    const entry = { target, contentRect: { width: resize.width } } as unknown as ResizeObserverEntry
    this.cb([entry], this as unknown as ResizeObserver)
  }
  unobserve(): void {}
  disconnect(): void {}
}

export function fakeResizeObserver(width: number): void {
  resize.width = width
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver
}

afterEach(() => {
  globalThis.ResizeObserver = original
})
