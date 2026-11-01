import { expect, it } from 'vitest'
import { baseEnvAdditions, mergeEnv } from '../../src/main/launch/env'

it('ids win over profile env; additions win over shell env', () => {
  const additions = baseEnvAdditions({ FOO: 'bar', PRAGMA_SESSION_ID: 'x' }, { sessionId: 's1', worktreeId: 'w1' })
  expect(additions).toEqual({ FOO: 'bar', PRAGMA_SESSION_ID: 's1', PRAGMA_WORKTREE_ID: 'w1' })
  expect(mergeEnv({ PATH: '/bin', FOO: 'shell' }, additions)).toEqual({ PATH: '/bin', ...additions })
})
