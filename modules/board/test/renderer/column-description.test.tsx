import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { boardIpc, type ColumnDto, BOARD_TESTIDS as T } from '../../src/contract'
import { ColumnHeader } from '../../src/renderer/components/ColumnHeader'
import { type BoardRendererContext, setBoardCtx } from '../../src/renderer/lib/runtime'

const invoke = vi.fn(async (contract: unknown, input: unknown) => ({
  ok: true,
  value: contract === boardIpc.listProjects ? [] : input,
}))

const review = (description: string): ColumnDto => ({ id: 14, boardId: 1, name: 'Review', sortKey: 'a3', description })

function renderHeader(description: string) {
  setBoardCtx({ ipc: { invoke } } as unknown as BoardRendererContext)
  const column = review(description)
  render(<ColumnHeader column={column} columns={[column]} taskCount={0} count={null} handle={undefined} />)
}

afterEach(() => {
  invoke.mockClear()
  setBoardCtx(undefined)
  document.body.innerHTML = ''
})

describe('column description', () => {
  it('the header shows no info icon without a description', () => {
    renderHeader('')
    expect(screen.queryByTestId(T.columnDescription)).toBeNull()
  })

  it('the header info icon carries the description as its title', () => {
    renderHeader('Needs review')
    expect(screen.getByTestId(T.columnDescription).getAttribute('title')).toBe('Needs review')
  })

  it('the dialog opened from the icon saves the edited text', async () => {
    renderHeader('Old')
    fireEvent.click(screen.getByTestId(T.columnDescription))
    const input = screen.getByTestId(T.columnDescriptionInput) as HTMLTextAreaElement
    expect(input.value).toBe('Old')
    expect(input.getAttribute('placeholder')).toBe('board:column.descriptionPlaceholder')
    fireEvent.change(input, { target: { value: 'Needs review' } })
    fireEvent.click(screen.getByTestId(T.columnDescriptionSave))
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(boardIpc.setColumnDescription, { columnId: 14, description: 'Needs review' }),
    )
    expect(screen.queryByTestId(T.columnDescriptionDialog)).toBeNull()
  })

  it('Ctrl+Enter saves', async () => {
    renderHeader('Old')
    fireEvent.click(screen.getByTestId(T.columnDescription))
    const input = screen.getByTestId(T.columnDescriptionInput)
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true })
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(boardIpc.setColumnDescription, { columnId: 14, description: '' }),
    )
  })
})
