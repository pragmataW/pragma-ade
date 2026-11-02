import { describe, expect, it } from 'vitest'
import type { TaskDto } from '../src/contract'
import { matchesTaskPredicate, type TaskPredicate } from '../src/lib/filter'
import { aLinkedSession, aTask } from './support/builders'

const withLabel = aTask({ id: 1, labelIds: [1], priority: 'high', title: 'fix login' })
const bare = aTask({ id: 3 })
const withWorktree = aTask({ id: 2, worktreeId: 'w1', priority: 'urgent' })
const withAgent = aTask({ id: 4, sessions: [aLinkedSession('s1')], sessionIds: ['s1'] })

describe('matchesTaskPredicate', () => {
  it.each<[string, TaskDto, TaskPredicate, boolean]>([
    ['label any-of hit', withLabel, { labelIds: [1, 2] }, true],
    ['label any-of miss', bare, { labelIds: [1, 2] }, false],
    ['empty labels = no constraint', bare, { labelIds: [] }, true],
    ['priority in list', withWorktree, { priorities: ['high', 'urgent'] }, true],
    ['priority not in list', bare, { priorities: ['high', 'urgent'] }, false],
    ['hasWorktree false excludes linked', withWorktree, { hasWorktree: false }, false],
    ['hasWorktree false keeps unlinked', bare, { hasWorktree: false }, true],
    ['query matches title case-insensitively', withLabel, { query: 'LOGIN' }, true],
    ['query matches key', aTask({ id: 3, key: 'PRA-3' }), { query: 'pra-3' }, true],
    ['query misses', bare, { query: 'zzz' }, false],
    ['empty predicate', bare, {}, true],
    ['session id', withAgent, { sessionId: 's1' }, true],
    ['other session id', withAgent, { sessionId: 's2' }, false],
    ['agent profile', withAgent, { agentProfileIds: ['fake'] }, true],
    ['agent profile miss', bare, { agentProfileIds: ['fake'] }, false],
    ['no agent includes bare', bare, { includeNoAgent: true }, true],
    ['no agent excludes linked', withAgent, { includeNoAgent: true }, false],
    ['column ids', bare, { columnIds: [2] }, false],
  ])('%s', (_name, task, p, expected) => expect(matchesTaskPredicate(task, p)).toBe(expected))
})
