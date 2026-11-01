import { expect, test } from 'vitest'
import { TerminalChannels, terminalIpc, terminalIpcEvents } from '../src/contract'
import { registerIpcHandlers } from '../src/main/ipc-handlers'
import { TerminalLayoutStore } from '../src/main/layout-store'
import { fakeIpc, fakePtyFeed } from './support/factories'

function setup() {
  const { ipc, handlers, published, call } = fakeIpc()
  const pty = fakePtyFeed()
  const opened: string[] = []
  const layouts = new TerminalLayoutStore({
    pty,
    getWorktreePath: async () => '/repo/w1',
    onChange: (l) => ipc.publish(terminalIpcEvents.layoutChanged, l),
  })
  registerIpcHandlers(ipc, {
    pty,
    layouts,
    openExternal: () => async (url) => {
      opened.push(url)
    },
  })
  const events = (channel: string) => published.filter((p) => p.channel === channel).map((p) => p.payload)
  return { handlers, call, pty, opened, events }
}

test('registers every TerminalChannels contract', () => {
  const { handlers } = setup()
  expect([...handlers.keys()].sort()).toEqual(
    Object.values(terminalIpc)
      .map((c) => c.channel)
      .sort(),
  )
  const eventChannels = new Set(Object.values(terminalIpcEvents).map((c) => c.channel))
  expect([...handlers.keys(), ...eventChannels].sort()).toEqual(Object.values(TerminalChannels).sort())
})

test('ptyAttach unknown id → {found:false}', async () => {
  const { call } = setup()
  expect(await call(terminalIpc.ptyAttach, { ptyId: 'nope' })).toEqual({ found: false })
})

test('ptyData published with seq', () => {
  const { pty, events } = setup()
  pty.emitData({ ptyId: 'p', seq: 7, data: 'x' })
  expect(events(TerminalChannels.ptyData)).toEqual([{ ptyId: 'p', seq: 7, data: 'x' }])
})

test('ptyExit is published and marks the layout pane', async () => {
  const { call, pty, events } = setup()
  const layout = await call(terminalIpc.tabCreate, { worktreeId: 'w1' })
  const ptyId = layout.tabs[0]?.panes[0]?.ptyId ?? ''
  pty.emitExit({ ptyId, exitCode: 0, signal: null, reason: 'exited' })
  expect(events(TerminalChannels.ptyExit)).toHaveLength(1)
  const latest = (await call(terminalIpc.layoutGet, { worktreeId: 'w1' })).tabs[0]?.panes[0]
  expect(latest?.exit).toEqual({ exitCode: 0, signal: null, reason: 'exited' })
})

test('layout mutations publish terminal.layoutChanged', async () => {
  const { call, events } = setup()
  const created = await call(terminalIpc.tabCreate, { worktreeId: 'w1' })
  const tabId = created.tabs[0]?.id ?? ''
  await call(terminalIpc.tabRename, { worktreeId: 'w1', tabId, title: 'build' })
  await call(terminalIpc.tabSplit, { worktreeId: 'w1', tabId, direction: 'vertical' })
  expect(events(TerminalChannels.layoutChanged)).toHaveLength(3)
})

test.each(['file:///etc/passwd', 'javascript:alert(1)', 'ssh://x', 'not a url'])('openLink rejects %s', async (url) => {
  const { call, opened } = setup()
  await expect(call(terminalIpc.openLink, { url })).rejects.toThrow('terminal: unsupported link scheme')
  expect(opened).toEqual([])
})

test('openLink forwards https URLs to ctx.shell.openExternal', async () => {
  const { call, opened } = setup()
  await call(terminalIpc.openLink, { url: 'https://example.test/ok' })
  expect(opened).toEqual(['https://example.test/ok'])
})
