import { PRIORITIES } from '@pragma/module-board/contract'
import { COMMENT_STATUS_FILTERS } from '@pragma/module-comments/contract'
import { describe, expect, it } from 'vitest'
import {
  ASK_MAX_TIMEOUT_SECONDS,
  CLI_COMMENT_STATUS_FILTERS,
  CLI_METHODS,
  CLI_PRIORITIES,
  cliErrorSchema,
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

  it('taskColumns takes an optional non-empty project id', () => {
    expect(cliRequestSchemas.taskColumns.safeParse({ context }).success).toBe(true)
    expect(cliRequestSchemas.taskColumns.safeParse({ context, projectId: '' }).success).toBe(false)
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

  it('errors may carry the timeout code', () => {
    expect(cliErrorSchema.safeParse({ code: 'timeout', message: 'slow' }).success).toBe(true)
  })

  it.each([
    ['at the limit', 'a'.repeat(MAX_DOCUMENT_BYTES), true],
    ['over the limit', 'a'.repeat(MAX_DOCUMENT_BYTES + 1), false],
  ])('ask prompt limit: %s', (_name, prompt, ok) => {
    expect(cliRequestSchemas.ask.safeParse({ context, to: 'oc', prompt }).success).toBe(ok)
  })

  it.each([
    [1, true],
    [ASK_MAX_TIMEOUT_SECONDS, true],
    [0, false],
    [ASK_MAX_TIMEOUT_SECONDS + 1, false],
  ])('ask timeoutSeconds %s', (timeoutSeconds, ok) => {
    expect(cliRequestSchemas.ask.safeParse({ context, to: 'oc', prompt: 'q', timeoutSeconds }).success).toBe(ok)
  })

  it('both ask result variants parse', () => {
    expect(cliResultSchemas.ask.safeParse({ status: 'pending', askId: 'a' }).success).toBe(true)
    const answered = {
      status: 'answered',
      askId: 'a',
      profile: { id: 'oc', name: 'OpenCode', providerId: 'opencode' },
      text: '42',
      truncated: false,
      durationMs: 1,
    }
    expect(cliResultSchemas.askWait.safeParse(answered).success).toBe(true)
    expect(cliResultSchemas.askWait.safeParse({ ...answered, text: undefined }).success).toBe(false)
  })
})
