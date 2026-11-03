import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHAT_TESTIDS } from '../../../src/contract'
import { RichMarkdown } from '../../../src/renderer/kit/parts/markdown/RichMarkdown'
import { renderChat } from '../support'

const mermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(async (id: string) => ({ svg: `<svg id="${id}" data-fake="1"><g></g></svg>` })),
}))
vi.mock('mermaid', () => ({ default: mermaid }))

const copied = vi.hoisted(() => vi.fn(async (_text: string) => true))
vi.mock('@pragma/ui/lib/clipboard', () => ({ copyText: copied }))

const TABLE = [
  '| Name | Count | Share | Note |',
  '| :--- | ---: | :-: | --- |',
  '| alpha | 1,024 | 12% | first, one |',
  '| beta | 7 | 3% | say "hi" |',
].join('\n')
const NUMERIC = ['| Item | Size |', '| --- | --- |', '| a | 10 |', '| b | 2.5k |'].join('\n')
const fence = (lang: string, body: string, closed = true) => `\`\`\`${lang}\n${body}\n${closed ? '```\n' : ''}`

const show = (text: string, streaming = false) =>
  renderChat(<RichMarkdown text={text} streaming={streaming} onLinkClick={vi.fn()} />)
const cells = (row: number) => screen.getAllByRole('row')[row]?.querySelectorAll('th,td') ?? []

beforeEach(() => {
  mermaid.render.mockClear()
  mermaid.initialize.mockClear()
  copied.mockClear()
})

describe('RichMarkdown tables', () => {
  it('honours Markdown alignment in a bordered card', () => {
    show(TABLE)
    const table = screen.getByTestId(CHAT_TESTIDS.mdTable)
    expect(within(table).getByRole('table')).toBeInTheDocument()
    const [name, count, share] = Array.from(cells(1)) as HTMLElement[]
    expect(name?.style.textAlign).toBe('left')
    expect(count?.style.textAlign).toBe('right')
    expect(share?.style.textAlign).toBe('center')
  })

  it('right-aligns numeric columns the Markdown leaves unaligned', () => {
    show(NUMERIC)
    const [item, size] = Array.from(cells(1))
    expect(item?.hasAttribute('data-numeric')).toBe(false)
    expect(size?.hasAttribute('data-numeric')).toBe(true)
  })

  it.each([
    [
      CHAT_TESTIDS.mdTableCopyMarkdown,
      '| Name | Count | Share | Note |\n| :--- | ---: | :---: | --- |\n| alpha | 1,024 | 12% | first, one |\n| beta | 7 | 3% | say "hi" |',
    ],
    [CHAT_TESTIDS.mdTableCopyCsv, 'Name,Count,Share,Note\nalpha,"1,024",12%,"first, one"\nbeta,7,3%,"say ""hi"""'],
  ])('copies the table (%s)', async (testId, expected) => {
    show(TABLE)
    fireEvent.click(screen.getByTestId(testId))
    await waitFor(() => expect(copied).toHaveBeenCalledWith(expected))
  })

  it.each([
    ['the row being typed', `${TABLE}\n| gam`],
    ['a header without its delimiter', 'Intro\n\n| Name | Count |\n'],
  ])('holds back %s while streaming', (_label, text) => {
    show(text, true)
    expect(screen.queryByText('gam')).toBeNull()
    expect(screen.queryByText(/\| Name/)).toBeNull()
  })
})

describe('RichMarkdown fences', () => {
  it('renders a closed mermaid fence as a strict-mode SVG with a source toggle', async () => {
    show(fence('mermaid', 'graph TD; A-->B'))
    await screen.findByTestId(CHAT_TESTIDS.mermaidDiagram)
    expect(mermaid.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ securityLevel: 'strict', htmlLabels: false }),
    )
    expect(mermaid.render).toHaveBeenCalledWith(expect.any(String), 'graph TD; A-->B')
    fireEvent.click(within(screen.getByTestId(CHAT_TESTIDS.mermaidView)).getByText('Source'))
    expect(screen.queryByTestId(CHAT_TESTIDS.mermaidDiagram)).toBeNull()
    expect(screen.getByText('graph TD; A-->B')).toBeInTheDocument()
  })

  it('opens the diagram in a zoom dialog', async () => {
    show(fence('mermaid', 'graph LR; X-->Y'))
    fireEvent.click(await screen.findByTestId(CHAT_TESTIDS.mermaidExpand))
    const dialog = await screen.findByTestId(CHAT_TESTIDS.mermaidDialog)
    fireEvent.click(within(dialog).getByLabelText('Zoom in'))
    expect(within(dialog).getByText('125%')).toBeInTheDocument()
  })

  it('falls back to the source when Mermaid rejects the diagram', async () => {
    mermaid.render.mockRejectedValueOnce(new Error('Parse error'))
    show(fence('mermaid', 'graph ???'))
    expect(await screen.findByTestId(CHAT_TESTIDS.mermaidError)).toHaveTextContent('graph ???')
    expect(screen.queryByTestId(CHAT_TESTIDS.mermaidDiagram)).toBeNull()
  })

  it('keeps a mermaid fence as code until it closes', async () => {
    const { rerender } = show(fence('mermaid', 'graph TD; A-->', false), true)
    expect(screen.getByTestId(CHAT_TESTIDS.codeFrame)).toHaveTextContent('graph TD; A-->')
    expect(mermaid.render).not.toHaveBeenCalled()
    rerender(<RichMarkdown text={fence('mermaid', 'graph TD; A-->B')} streaming onLinkClick={vi.fn()} />)
    await screen.findByTestId(CHAT_TESTIDS.mermaidDiagram)
    expect(mermaid.render).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['', '┌──┐\n│ok│\n└──┘', 'Diagram'],
    ['text', 'plain words', 'text'],
  ])('keeps a %j fence as exact-layout plain text', (lang, body, label) => {
    show(fence(lang, body))
    const frame = screen.getByTestId(CHAT_TESTIDS.codeFrame)
    expect(frame.getAttribute('data-variant')).toBe('ascii')
    expect(frame).toHaveTextContent(label)
    expect(frame.querySelector('pre')?.textContent).toBe(body)
  })

  it('labels highlighted code with its language and offers copy', async () => {
    show(fence('ts', 'const a = 1'))
    const frame = screen.getByTestId(CHAT_TESTIDS.codeFrame)
    expect(frame.getAttribute('data-variant')).toBe('code')
    expect(frame).toHaveTextContent('ts')
    await act(async () => undefined)
    expect(within(frame).getByTestId(CHAT_TESTIDS.copyCode)).toBeInTheDocument()
  })
})

describe('RichMarkdown list-item fences', () => {
  const LIST = [
    '1. Emit a map:',
    '   ```yaml',
    '   tools:',
    '     read: true',
    '   ```',
    '   Then verify.',
    '2. Next',
  ].join('\n')

  it('keeps the list whole and frames the nested code', async () => {
    const { container } = show(LIST)
    expect(container.querySelectorAll('ol')).toHaveLength(1)
    expect(container.querySelectorAll('ol > li')).toHaveLength(2)
    const frame = within(container.querySelector('li') as HTMLElement).getByTestId(CHAT_TESTIDS.codeFrame)
    expect(frame.getAttribute('data-variant')).toBe('code')
    expect(frame).toHaveTextContent('yaml')
    await waitFor(() => expect(frame.querySelector('.shiki')).not.toBeNull())
    expect(frame.querySelector('pre')?.textContent).toBe('tools:\n  read: true')
  })

  it('renders a nested mermaid fence as a diagram', async () => {
    show('- flow:\n\n  ```mermaid\n  graph TD; A-->B\n  ```')
    await screen.findByTestId(CHAT_TESTIDS.mermaidDiagram)
    expect(mermaid.render).toHaveBeenCalledWith(expect.any(String), 'graph TD; A-->B')
  })

  it('keeps inline code inline', () => {
    const { container } = show('- use `x` here')
    expect(container.querySelector('li code')?.textContent).toBe('x')
    expect(screen.queryByTestId(CHAT_TESTIDS.codeFrame)).toBeNull()
  })
})

describe('RichMarkdown prose', () => {
  it('draws task-list boxes', () => {
    const { container } = show('- [x] done\n- [ ] todo')
    expect(container.querySelectorAll('[data-checked]')).toHaveLength(1)
    expect(container.querySelector('input')).toBeNull()
  })
})
