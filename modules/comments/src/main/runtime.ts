import type { CommentsServiceImpl } from './service'

let current: CommentsServiceImpl | undefined

/** The active service, for `test-hooks.ts` (which is loaded after `activate`). */
export const setMainService = (s: CommentsServiceImpl | undefined): void => {
  current = s
}

export function getMainService(): CommentsServiceImpl {
  if (!current) throw new Error('comments: main module is not active')
  return current
}
