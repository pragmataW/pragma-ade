import { CODE_SEGMENT, FENCE_CLOSE_RE, FENCE_OPEN_RE, LINE_SPLIT_RE, NEWLINE } from '../../constants'

export type MarkdownSegment =
  | { kind: 'prose'; text: string }
  | {
      kind: 'code'
      code: string
      lang: string
      /** False while the fence is still open (streaming): diagrams and highlighting wait for the close. */
      closed: boolean
    }

const PROSE = 'prose'
const WORD_SPLIT_RE = /\s+/

interface OpenFence {
  fence: string
  lang: string
  lines: string[]
}

const closes = (line: string, open: OpenFence): boolean => {
  const fence = FENCE_CLOSE_RE.exec(line)?.groups?.fence ?? ''
  return fence[0] === open.fence[0] && fence.length >= open.fence.length
}

class Splitter {
  readonly out: MarkdownSegment[] = []
  #prose: string[] = []
  #code: OpenFence | null = null

  line(line: string): void {
    if (this.#code) {
      this.#inCode(line, this.#code)
      return
    }
    const open = FENCE_OPEN_RE.exec(line)?.groups
    if (!open) {
      this.#prose.push(line)
      return
    }
    this.#flushProse()
    this.#code = { fence: open.fence ?? '', lang: (open.info ?? '').trim().split(WORD_SPLIT_RE)[0] ?? '', lines: [] }
  }

  end(): MarkdownSegment[] {
    this.#flushCode(false)
    this.#flushProse()
    return this.out
  }

  #inCode(line: string, code: OpenFence): void {
    if (closes(line, code)) this.#flushCode(true)
    else code.lines.push(line)
  }

  #flushCode(closed: boolean): void {
    if (this.#code)
      this.out.push({ kind: CODE_SEGMENT, code: this.#code.lines.join(NEWLINE), lang: this.#code.lang, closed })
    this.#code = null
  }

  #flushProse(): void {
    const text = this.#prose.join(NEWLINE)
    if (text.trim()) this.out.push({ kind: PROSE, text })
    this.#prose = []
  }
}

/**
 * Top-level fenced code blocks (``` or ~~~, at most 3 spaces indent) split from the prose around them, so each block
 * can carry its own copy button. An unclosed fence runs to the end (as CommonMark does while a message streams).
 */
export function splitFences(md: string): MarkdownSegment[] {
  const s = new Splitter()
  for (const line of md.split(LINE_SPLIT_RE)) s.line(line)
  return s.end()
}
