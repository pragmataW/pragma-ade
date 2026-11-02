/** Polls `cond` until it holds or `ms` passes. */
export async function until(cond: () => boolean, ms = 5000, stepMs = 20): Promise<void> {
  const end = Date.now() + ms
  while (!cond()) {
    if (Date.now() > end) throw new Error('condition not met')
    await new Promise((r) => setTimeout(r, stepMs))
  }
}
