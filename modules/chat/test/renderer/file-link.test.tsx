import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentType } from 'react'
import { describe, expect, it } from 'vitest'
import { CHAT_TESTIDS, type ChatEvent, type ChatItem, type ChatPartProps } from '../../src/contract'
import { AssistantText } from '../../src/renderer/kit/parts/AssistantText'
import { FileEditDiff } from '../../src/renderer/kit/parts/FileEditDiff'
import { ToolCallCard } from '../../src/renderer/kit/parts/ToolCallCard'
import { callsOf, stubChatHost, stubSessionApi } from '../../testing'
import { edit, text, tool } from './parts/samples'
import { renderChat } from './support'

const WORKTREE = { id: 'w1', path: '/w/repo' }
const OPEN = 'editor.openFile'
const REVEAL = 'gitChanges.reveal'

/** One part over `events`, a host whose registered commands are `commands`, a session in `WORKTREE`. */
function renderPart(Part: ComponentType<ChatPartProps<never>>, events: ChatEvent[], commands: string[] = [OPEN]) {
  const host = stubChatHost()
  host.commands.has = (id) => commands.includes(id)
  const s = stubSessionApi(events, { worktree: WORKTREE })
  const P = Part as ComponentType<ChatPartProps<ChatItem>>
  renderChat(<P item={s.api.transcript.items[0] as ChatItem} session={s.api} />, host)
  return { host, executed: () => callsOf(host, 'executeCommand').map((c) => c.args) }
}

describe('chat file links (11c)', () => {
  it('plain text without editor.openFile', () => {
    renderPart(FileEditDiff, [edit('e1')], [])
    expect(screen.queryByTestId(CHAT_TESTIDS.fileLink)).toBeNull()
    expect(screen.getByText('src/app.ts')).toBeInTheDocument()
  })

  it('edit header click executes editor.openFile', async () => {
    const r = renderPart(FileEditDiff, [edit('e1')])
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.fileLink))
    expect(r.executed()).toEqual([[OPEN, { worktreeId: 'w1', path: 'src/app.ts' }]])
  })

  it.each([
    [[OPEN, REVEAL], true],
    [[OPEN], false],
  ])('reveal button with commands %j = %s', async (commands, shown) => {
    const r = renderPart(FileEditDiff, [edit('e1')], commands)
    const reveal = screen.queryByTestId(CHAT_TESTIDS.revealInGit)
    expect(reveal !== null).toBe(shown)
    if (!reveal) return
    await userEvent.click(reveal)
    expect(r.executed()).toEqual([[REVEAL, { worktreeId: 'w1', path: 'src/app.ts' }]])
  })

  it('tool target (file_path input) links to the file', async () => {
    const r = renderPart(ToolCallCard, [
      tool('t1', { toolKind: 'read', title: 'a.ts', input: { file_path: '/w/repo/src/a.ts' } }),
    ])
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.fileLink))
    expect(r.executed()).toEqual([[OPEN, { worktreeId: 'w1', path: 'src/a.ts' }]])
  })

  it('click on an inline code reference executes editor.openFile with line', async () => {
    const r = renderPart(AssistantText, [text('p1', 'See `src/a.ts:3` and `README`, not `../x.ts`.')])
    const code = screen.getByText('src/a.ts:3')
    expect(code).toHaveAttribute('role', 'link')
    expect(screen.getByText('README')).not.toHaveAttribute('role')
    expect(screen.getByText('../x.ts')).not.toHaveAttribute('role')
    await userEvent.click(code)
    expect(r.executed()).toEqual([[OPEN, { worktreeId: 'w1', path: 'src/a.ts', line: 3 }]])
  })

  it('markdown file links open the editor, web links open externally', async () => {
    const r = renderPart(AssistantText, [text('p1', '[the file](src/b.ts#L12) and [docs](https://x.dev/a)')])
    await userEvent.click(screen.getByText('the file'))
    await userEvent.click(screen.getByText('docs'))
    expect(r.executed()).toEqual([[OPEN, { worktreeId: 'w1', path: 'src/b.ts', line: 12 }]])
    expect(callsOf(r.host, 'openExternal').map((c) => c.args)).toEqual([['https://x.dev/a']])
  })
})
