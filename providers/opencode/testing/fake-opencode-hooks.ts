import { join } from 'node:path'

/** Absolute path of the fake OpenCode 2.x (executable script). */
export const fakeOpencodeHooksPath = join(import.meta.dirname, 'fake-opencode-hooks', 'index.mjs')
