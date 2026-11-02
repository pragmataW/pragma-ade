import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CHAT_TESTIDS } from '../../../src/contract'
import { todosOf } from '../../../src/renderer/kit/parts/ToolBodies'
import { ToolCallCard } from '../../../src/renderer/kit/parts/ToolCallCard'
import { callsOf, stubChatHost } from '../../../testing'
import { renderPart } from '../support'
import { result, tool } from './samples'

const open = () => userEvent.click(screen.getByRole('button', { expanded: false }))

describe('tool bodies', () => {
  it('edit: the change as a diff, no raw JSON', async () => {
    renderPart(ToolCallCard, [
      tool('e', {
        name: 'Edit',
        toolKind: 'edit',
        input: { file_path: 'src/a.ts', old_string: 'const a = 1', new_string: 'const a = 2' },
      }),
    ])
    await open()
    expect(screen.queryByText(/"old_string"/)).toBeNull()
    expect(screen.queryByTestId(CHAT_TESTIDS.toolJson)).toBeNull()
  })

  it('web: a URL card that opens externally, then the result preview', async () => {
    const host = stubChatHost()
    renderPart(
      ToolCallCard,
      [
        tool('w', { name: 'WebFetch', toolKind: 'web', input: { url: 'https://example.com/docs' } }),
        result('w', 'Docs page'),
      ],
      { host },
    )
    await open()
    await userEvent.click(screen.getByRole('button', { name: 'https://example.com/docs' }))
    expect(callsOf(host, 'openExternal')[0]?.args).toEqual(['https://example.com/docs'])
    expect(screen.getByText('Docs page')).toBeInTheDocument()
  })

  it('web search: the query', async () => {
    renderPart(ToolCallCard, [
      tool('s', { name: 'WebSearch', toolKind: 'web', title: undefined, input: { query: 'zod v4' } }),
    ])
    await open()
    expect(screen.getAllByText('zod v4').length).toBeGreaterThan(0)
  })

  it('todo: a checklist from TodoWrite-like input', async () => {
    renderPart(ToolCallCard, [
      tool('t', {
        name: 'TodoWrite',
        toolKind: 'todo',
        input: {
          todos: [
            { content: 'Write tests', status: 'completed' },
            { content: 'Ship', status: 'in_progress' },
          ],
        },
      }),
    ])
    await open()
    expect(screen.getAllByRole('listitem').map((li) => li.getAttribute('data-status'))).toEqual(['done', 'active'])
  })

  it.each([
    [{ todos: [{ text: 'a', status: 'pending', id: 'x' }] }, [{ id: 'x', text: 'a', status: 'pending' }]],
    [{ todos: [{ title: 'b', status: 'weird' }] }, [{ id: '0', text: 'b', status: 'pending' }]],
    [{ nope: 1 }, []],
  ])('todosOf(%o)', (input, expected) => {
    expect(todosOf(input)).toEqual(expected)
  })

  it('other: primitive fields as key/value rows; the full JSON on demand; the output', async () => {
    renderPart(ToolCallCard, [
      tool('o', {
        name: 'mcp__db__query',
        toolKind: 'other',
        input: { sql: 'select 1', limit: 5, nested: { deep: true } },
      }),
      result('o', '1 row'),
    ])
    await open()
    expect(screen.getByText('sql')).toBeInTheDocument()
    expect(screen.getByText('select 1')).toBeInTheDocument()
    expect(screen.queryByText(/"deep"/)).toBeNull()
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.toolJson))
    expect(screen.getByText(/"deep": true/)).toBeInTheDocument()
    expect(screen.getByText('1 row')).toBeInTheDocument()
  })
})
