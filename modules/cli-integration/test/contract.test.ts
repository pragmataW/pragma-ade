import { PRIORITIES } from '@pragma/module-board/contract'
import { COMMENT_STATUS_FILTERS } from '@pragma/module-comments/contract'
import { describe, expect, it } from 'vitest'
import {
  CLI_COMMENT_STATUS_FILTERS,
  CLI_METHODS,
  CLI_PRIORITIES,
  cliIntegrationSettingsSchema,
  cliRequestSchemas,
  cliResultSchemas,
  MAX_DOCUMENT_BYTES,
} from '../src/contract'

const context = { cwd: '/x' }

describe('cli bridge contract', () => {
  it.each(CLI_METHODS)('every CliMethod has a request and result schema: %s', (m) => {
    expect(cliRequestSchemas[m]).toBeDefined()
    expect(cliResultSchemas[m]).toBeDefined()
  })

  it('schema maps have exactly one entry per method', () => {
    expect(Object.keys(cliRequestSchemas)).toHaveLength(CLI_METHODS.length)
    expect(Object.keys(cliResultSchemas)).toHaveLength(CLI_METHODS.length)
  })

  it('requests require context.cwd', () => {
    expect(cliRequestSchemas.worktreeList.safeParse({}).success).toBe(false)
    expect(cliRequestSchemas.worktreeList.safeParse({ context }).success).toBe(true)
  })

  it('taskUpdate needs at least one field', () => {
    expect(cliRequestSchemas.taskUpdate.safeParse({ context, taskId: '42' }).success).toBe(false)
    expect(cliRequestSchemas.taskUpdate.safeParse({ context, taskId: '42', title: 'a' }).success).toBe(true)
  })

  it.each([
    ['empty', '', false],
    ['at the limit', 'a'.repeat(MAX_DOCUMENT_BYTES), true],
    ['over the limit', 'a'.repeat(MAX_DOCUMENT_BYTES + 1), false],
  ])('handoff document limit: %s', (_name, document, ok) => {
    const req = { context, to: 'opencode', sameWorktree: false, document }
    expect(cliRequestSchemas.handoff.safeParse(req).success).toBe(ok)
  })

  it.each([
    ['urgent', true],
    ['p1', false],
  ])('priority enum: %s', (priority, ok) => {
    expect(cliRequestSchemas.taskCreate.safeParse({ context, title: 't', priority }).success).toBe(ok)
  })

  it('cli priorities equal the board priorities', () => {
    expect([...CLI_PRIORITIES]).toEqual([...PRIORITIES])
  })

  it('cli comment status filters equal the comments filters', () => {
    expect([...CLI_COMMENT_STATUS_FILTERS]).toEqual([...COMMENT_STATUS_FILTERS])
  })

  it('commentsReply takes exactly one of body and document', () => {
    const reply = (extra: object) => cliRequestSchemas.commentsReply.safeParse({ context, commentId: 'c', ...extra })
    expect(reply({ body: 'a' }).success).toBe(true)
    expect(reply({ document: 'a' }).success).toBe(true)
    expect(reply({}).success).toBe(false)
    expect(reply({ body: 'a', document: 'b' }).success).toBe(false)
  })

  it('settings defaults round-trip', () => {
    const value = { installDir: null, skillUpdatePromptedHash: null }
    expect(cliIntegrationSettingsSchema.parse(value)).toEqual(value)
  })
})
