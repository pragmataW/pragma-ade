import { afterAll, beforeAll } from 'vitest'
import { CACHE_ENV } from '../../constants.ts'
import { mkTemp } from '../../lib/fsx.ts'

/** Points the tool's cache root at a temp dir for the current test file. */
export function useTempCache(label = 'cache root'): { dir: () => string } {
  let dir = ''
  let previous: string | undefined
  beforeAll(() => {
    previous = process.env[CACHE_ENV]
    dir = mkTemp(label)
    process.env[CACHE_ENV] = dir
  })
  afterAll(() => {
    if (previous === undefined) delete process.env[CACHE_ENV]
    else process.env[CACHE_ENV] = previous
  })
  return { dir: () => dir }
}
