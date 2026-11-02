import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ClaudeChatSession } from '../../src/main/chat/session'
import {
  FAKE_EDIT_INPUT,
  FAKE_INIT,
  FAKE_PERMISSION_ID,
  FAKE_STDERR,
  FAKE_TEXT,
} from '../../testing/fake-claude-stream/scenario'
import { isKind, readReport, sessionContext, startSession } from './support'

const controlFor = (lines: ReturnType<typeof readReport>, id: string) =>
  lines.at(-1)?.controlResponses.find((f) => f.response.request_id === id)?.response.response
const startupError = async (scenario: Parameters<typeof sessionContext>[0], setup = {}) => {
  const { ctx } = sessionContext(scenario, setup)
  return ClaudeChatSession.start(ctx).then(
    () => undefined,
    (e: unknown) => e as { reasonKey: string; detail?: string },
  )
}

describe('ClaudeChatSession', () => {
  it('basic: streams text-delta, usage, turn-end completed', async () => {
    const s = await startSession('basic')
    await s.send('hi')
    await s.waitForEvent(isKind('turn-end'))
    const kinds = s.events.map((e) => e.kind)
    expect(kinds.filter((k) => k === 'text-delta').length).toBeGreaterThan(2)
    expect(kinds.slice(-2)).toEqual(['usage', 'turn-end'])
    expect(s.events.at(-1)).toEqual({ kind: 'turn-end', reason: 'completed' })
    const snapshot = s.events.find(isKind('text-delta', (e) => e.mode === 'snapshot'))
    expect(snapshot).toMatchObject({ text: FAKE_TEXT.basic })
  })

  it('session-info commands and options model list come from initialize', async () => {
    const s = await startSession('basic')
    expect(s.events[0]).toMatchObject({
      kind: 'session-info',
      externalSessionId: s.session.externalSessionId,
      commands: [{ name: 'review' }, { name: 'compact', argumentHint: '[instructions]' }],
    })
    const model = s.session.describeOptions().find((o) => o.key === 'model')
    expect(model?.values?.map((v) => [v.value, v.label])).toEqual(
      FAKE_INIT?.models.map((m) => [m.value === 'default' ? null : m.value, m.displayName]),
    )
    expect(s.events[1]).toMatchObject({ kind: 'options' })
  })

  it('setOption model sends set_model; effort sends apply_flag_settings effortLevel; unknown key rejects', async () => {
    const s = await startSession('basic')
    await s.session.setOption('effort', 'high')
    await s.session.setOption('model', 'fake-opus')
    const requests =
      readReport(s.home.report)
        .at(-1)
        ?.controlRequests.map((f) => f.request) ?? []
    expect(requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ subtype: 'apply_flag_settings', settings: { effortLevel: 'high' } }),
        expect.objectContaining({ subtype: 'set_model', model: 'fake-opus' }),
      ]),
    )
    expect(s.events.at(-1)).toMatchObject({ kind: 'options' })
    expect(s.session.describeOptions().find((o) => o.key === 'effort')).toBeUndefined()
    await expect(s.session.setOption('nope', 1)).rejects.toThrow()
    await expect(s.session.setOption('model', 'not-a-model')).rejects.toThrow()
  })

  it('permissionMode option omitted when profile has --dangerously-skip-permissions', async () => {
    const plain = await startSession('basic')
    expect(plain.session.describeOptions().find((o) => o.key === 'permissionMode')).toMatchObject({
      current: 'default',
      values: expect.arrayContaining([expect.objectContaining({ value: 'bypassPermissions', dangerous: true })]),
    })
    const skip = await startSession('basic', { args: ['--dangerously-skip-permissions'] })
    expect(skip.session.describeOptions().map((o) => o.key)).not.toContain('permissionMode')
  })

  it.each([
    ['allow_once', { behavior: 'allow', updatedInput: FAKE_EDIT_INPUT }],
    ['allow_always', { behavior: 'allow', updatedInput: FAKE_EDIT_INPUT, updatedPermissions: [expect.anything()] }],
    ['deny', { behavior: 'deny', message: expect.any(String) }],
  ] as const)('permission %s → matching control_response', async (decision, expected) => {
    const s = await startSession('tool-edit-permission')
    await s.send('edit')
    const request = await s.waitForEvent(isKind('permission-request'))
    expect(request).toMatchObject({
      requestId: FAKE_PERMISSION_ID,
      toolName: 'Edit',
      toolKind: 'edit',
      title: 'README.md',
      options: ['allow_once', 'allow_always', 'deny'],
    })
    await s.session.respondPermission(FAKE_PERMISSION_ID, decision)
    await s.waitForEvent(isKind('turn-end'))
    expect(controlFor(readReport(s.home.report), FAKE_PERMISSION_ID)).toMatchObject(expected)
    expect(s.events.find(isKind('permission-resolved'))).toMatchObject({ requestId: FAKE_PERMISSION_ID })
  })

  it('interrupt during awaitInterrupt → turn-end interrupted', async () => {
    const s = await startSession('interrupt')
    await s.send('go')
    await s.waitForEvent(isKind('text-delta', (e) => e.mode === 'snapshot'))
    await s.session.interrupt()
    expect(await s.waitForEvent(isKind('turn-end'))).toEqual({ kind: 'turn-end', reason: 'interrupted' })
    expect(
      readReport(s.home.report)
        .at(-1)
        ?.controlRequests.some((f) => f.request.subtype === 'interrupt'),
    ).toBe(true)
  })

  it('interrupt with pending permission → cancelled + deny', async () => {
    const s = await startSession('tool-edit-permission')
    await s.send('edit')
    await s.waitForEvent(isKind('permission-request'))
    await s.session.interrupt()
    expect(await s.waitForEvent(isKind('permission-resolved'))).toMatchObject({ outcome: 'cancelled' })
    expect(await s.waitForEvent(isKind('turn-end'))).toMatchObject({ reason: 'interrupted' })
    expect(controlFor(readReport(s.home.report), FAKE_PERMISSION_ID)).toMatchObject({ behavior: 'deny' })
  })

  it('close with pending permission → cancelled; session-exit closed once', async () => {
    const s = await startSession('tool-edit-permission')
    await s.send('edit')
    await s.waitForEvent(isKind('permission-request'))
    await Promise.all([s.session.close(), s.session.close()])
    expect(s.events.find(isKind('permission-resolved'))).toMatchObject({ outcome: 'cancelled' })
    expect(s.events.filter(isKind('session-exit'))).toEqual([
      { kind: 'session-exit', exitCode: expect.anything(), reason: 'closed' },
    ])
  })

  it('crash → error process_exited with stderr tail, session-exit crashed', async () => {
    const s = await startSession('crash')
    await s.send('go')
    await s.waitForEvent(isKind('session-exit'))
    const error = s.events.find(isKind('error'))
    expect(error).toMatchObject({ code: 'process_exited', fatal: true, detail: FAKE_STDERR.trim() })
    expect(s.events.slice(-2)).toEqual([
      { kind: 'turn-end', reason: 'error' },
      { kind: 'session-exit', exitCode: 2, reason: 'crashed' },
    ])
  })

  it('not-stream-json → ChatStartupError noProtocol within 1500ms timeout', async () => {
    const started = Date.now()
    const error = await startupError('not-stream-json', { ctx: { startupTimeoutMs: 1500 } })
    expect(error).toMatchObject({ reasonKey: 'chat:unsupported.noProtocol' })
    expect(Date.now() - started).toBeLessThan(1500 + 1000)
  })

  it('exit before init → exitedEarly', async () => {
    expect(await startupError('exit-early')).toMatchObject({
      reasonKey: 'chat:unsupported.exitedEarly',
      detail: expect.stringContaining('exit 1: wrapper: cannot start claude'),
    })
  })

  describe('resume failures (11c): never an "unsupported" verdict', () => {
    const resume = { ctx: { resumeExternalSessionId: '88f976ca-736c-4d22-8d69-a298d1c792dc' } }

    it('exit before init while resuming → chat:resume.failed with the CLI reason', async () => {
      expect(await startupError('exit-early', resume)).toMatchObject({
        reasonKey: 'chat:resume.failed',
        detail: expect.stringContaining('exit 1: wrapper: cannot start claude'),
      })
    })

    it('"No conversation found with session ID" → chat:resume.notFound', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'pragma-claude-noconv-'))
      const command = join(dir, 'claude')
      writeFileSync(command, `#!/bin/sh\necho "No conversation found with session ID: $3" >&2\nexit 1\n`)
      chmodSync(command, 0o755)
      try {
        expect(await startupError('basic', { ...resume, command })).toMatchObject({
          reasonKey: 'chat:resume.notFound',
          detail: expect.stringContaining('exit 1: No conversation found with session ID'),
        })
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })
  })

  it('banner-then-protocol settles within timeout+1000ms', async () => {
    const started = Date.now()
    const s = await startSession('banner-then-protocol', { ctx: { startupTimeoutMs: 2000 } })
    expect(Date.now() - started).toBeLessThan(2000 + 1000)
    await s.send('hi')
    expect(await s.waitForEvent(isKind('turn-end'))).toMatchObject({ reason: 'completed' })
  })

  it('missing command → commandNotFound', async () => {
    expect(await startupError('basic', { command: '/nonexistent/dir/claude' })).toMatchObject({
      reasonKey: 'chat:unsupported.commandNotFound',
      detail: '/nonexistent/dir/claude',
    })
  })
})
