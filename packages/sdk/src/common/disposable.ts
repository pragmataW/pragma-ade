export interface Disposable {
  dispose(): void
}

export const toDisposable = (fn: () => void): Disposable => {
  let done = false
  return {
    dispose() {
      if (done) return
      done = true
      fn()
    },
  }
}

export const combineDisposables = (items: readonly Disposable[]): Disposable =>
  toDisposable(() => {
    for (const item of [...items].reverse()) item.dispose()
  })
