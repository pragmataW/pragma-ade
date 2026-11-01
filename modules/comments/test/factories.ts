/** Test data builders (§9: no copy-pasted setup). */
import type { AgentSession } from '@pragma/module-agents/contract'
import { aSession } from '@pragma/module-agents/testing'
import type { BrowserElementContext, Comment, CommentInput } from '../src/contract'

export const WT = 'wt-1'
export const OTHER_WT = 'wt-2'

/** A diff comment on `src/example.ts:1-2`. */
export function makeInput(overrides: Partial<CommentInput> = {}): CommentInput {
  return {
    worktreeId: WT,
    source: 'diff',
    filePath: 'src/example.ts',
    lineStart: 1,
    lineEnd: 2,
    snippet: 'const a = 1\nconst b = 2',
    language: 'ts',
    body: 'Rename these.',
    ...overrides,
  }
}

export function makeElement(overrides: Partial<BrowserElementContext> = {}): BrowserElementContext {
  return {
    url: 'http://localhost:5173/',
    selector: 'button',
    outerHtml: '<button>Go</button>',
    boundingBox: { x: 0, y: 0, width: 10, height: 10 },
    ...overrides,
  }
}

/** A browser comment with a minimal element. */
export function makeBrowserInput(overrides: Partial<CommentInput> = {}): CommentInput {
  return {
    worktreeId: WT,
    source: 'browser',
    element: makeElement(),
    body: 'Fix this element.',
    ...overrides,
  }
}

let seq = 0
/** A stored draft built from `makeInput`. */
export function makeComment(overrides: Partial<Comment> = {}): Comment {
  seq += 1
  const { worktreeId, source, filePath, lineStart, lineEnd, snippet, language, body } = makeInput()
  return {
    id: `c${seq}`,
    worktreeId,
    source,
    filePath,
    lineStart,
    lineEnd,
    snippet,
    language,
    body,
    createdAt: seq,
    updatedAt: seq,
    ...overrides,
  }
}

/** A running terminal session in `WT` with a pty. */
export function makeSession(overrides: Partial<AgentSession> = {}): AgentSession {
  seq += 1
  const id = overrides.id ?? `s${seq}`
  return aSession(id, seq, {
    worktreeId: WT,
    status: 'working',
    ptyId: `pty-${id}`,
    title: `Agent ${id}`,
    ...overrides,
  })
}
