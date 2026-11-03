import { z } from '@pragma/sdk'
import { BACKSLASH_RE, COMMENT_BODY_MAX_CHARS, CRLF_RE, NEWLINE } from '../constants'

export const COMMENT_SOURCE = { editor: 'editor', diff: 'diff', browser: 'browser' } as const
export const COMMENT_SOURCES = [COMMENT_SOURCE.editor, COMMENT_SOURCE.diff, COMMENT_SOURCE.browser] as const
export type CommentSource = (typeof COMMENT_SOURCES)[number]
/** 07: the side of the change the lines belong to. */
export const DIFF_SIDE = { old: 'old', new: 'new' } as const
export const DIFF_SIDES = [DIFF_SIDE.old, DIFF_SIDE.new] as const
export type DiffSide = (typeof DIFF_SIDES)[number]
/** A review thread is open until the user or the agent resolves it. */
export const COMMENT_STATUS = { open: 'open', resolved: 'resolved' } as const
export const COMMENT_STATUSES = [COMMENT_STATUS.open, COMMENT_STATUS.resolved] as const
export type CommentStatus = (typeof COMMENT_STATUSES)[number]
/** `list` filters: one status or every thread. */
export const COMMENT_STATUS_FILTER = { ...COMMENT_STATUS, all: 'all' } as const
export const COMMENT_STATUS_FILTERS = [COMMENT_STATUS.open, COMMENT_STATUS.resolved, COMMENT_STATUS_FILTER.all] as const
export type CommentStatusFilter = (typeof COMMENT_STATUS_FILTERS)[number]
/** Who wrote a reply: the user (any surface) or an agent (through the CLI). */
export const REPLY_AUTHOR = { user: 'user', agent: 'agent' } as const
export const REPLY_AUTHORS = [REPLY_AUTHOR.user, REPLY_AUTHOR.agent] as const
export type ReplyAuthor = (typeof REPLY_AUTHORS)[number]

const SLASH = '/'
const toLf = (s: string): string => s.replace(CRLF_RE, NEWLINE)
const lf = () => z.string().transform(toLf)
const filePath = () =>
  z
    .string()
    .min(1)
    .transform((p) => p.replace(BACKSLASH_RE, SLASH))
const line = () => z.number().int().min(1)
const body = () => z.string().trim().min(1).max(COMMENT_BODY_MAX_CHARS).transform(toLf)

/** 05 owns `element_json` (§10.3); 08 fills it. */
export const BrowserElementContextSchema = z.object({
  url: z.string(),
  selector: z.string(),
  outerHtml: z.string(),
  text: z.string().optional(),
  boundingBox: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }),
  styles: z.record(z.string(), z.string()).optional(),
  screenshotPath: z.string().optional(),
  consoleErrors: z.array(z.string()).optional(),
  component: z.object({ name: z.string(), source: z.string().optional() }).optional(),
})
export type BrowserElementContext = z.infer<typeof BrowserElementContextSchema>

/** Where a comment points (the composer's `context`); `\` → `/` in paths, CRLF → LF in snippets. */
export const CommentContextSchema = z.object({
  source: z.enum(COMMENT_SOURCES),
  filePath: filePath().optional(),
  lineStart: line().optional(),
  lineEnd: line().optional(),
  diffSide: z.enum(DIFF_SIDES).optional(),
  snippet: lf().optional(),
  language: z.string().optional(),
  element: BrowserElementContextSchema.optional(),
})
export type CommentContext = z.input<typeof CommentContextSchema>

type Anchor = Pick<z.infer<typeof CommentContextSchema>, 'source' | 'filePath' | 'lineStart' | 'lineEnd' | 'element'>
const ISSUE = {
  lineEndWithoutStart: 'lineEnd requires lineStart',
  lineOrder: 'lineEnd must be >= lineStart',
  browserElement: 'browser comments require element',
  codeFilePath: 'editor and diff comments require filePath',
} as const

/** Every anchor rule violated by `c` (empty when valid). */
function anchorIssues(c: Anchor): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = []
  if (c.lineEnd !== undefined && c.lineStart === undefined)
    issues.push({ path: 'lineStart', message: ISSUE.lineEndWithoutStart })
  if (c.lineEnd !== undefined && c.lineStart !== undefined && c.lineEnd < c.lineStart)
    issues.push({ path: 'lineEnd', message: ISSUE.lineOrder })
  if (c.source === COMMENT_SOURCE.browser && !c.element) issues.push({ path: 'element', message: ISSUE.browserElement })
  if (c.source !== COMMENT_SOURCE.browser && !c.filePath) issues.push({ path: 'filePath', message: ISSUE.codeFilePath })
  return issues
}

const CommentInputBaseSchema = CommentContextSchema.extend({ worktreeId: z.string().min(1), body: body() })

export const CommentInputSchema = CommentInputBaseSchema.superRefine((c, ctx) => {
  for (const issue of anchorIssues(c)) ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message })
})
export type CommentInput = z.input<typeof CommentInputSchema>

export const CommentPatchSchema = z.object({
  body: body().optional(),
  lineStart: line().optional(),
  lineEnd: line().optional(),
  snippet: lf().optional(),
})
export type CommentPatch = z.input<typeof CommentPatchSchema>

/** What a reply needs; `sessionId` / `authorLabel` name the agent session (CLI replies). */
export const ReplyInputSchema = z.object({
  body: body(),
  author: z.enum(REPLY_AUTHORS),
  sessionId: z.string().min(1).optional(),
  authorLabel: z.string().min(1).optional(),
})
export type ReplyInput = z.input<typeof ReplyInputSchema>

/** One reply of a thread. `round` is the review round that delivered it; absent = pending (a user reply not sent yet). */
export const CommentReplySchema = z.object({
  id: z.string(),
  commentId: z.string(),
  author: z.enum(REPLY_AUTHORS),
  body: z.string(),
  sessionId: z.string().optional(),
  authorLabel: z.string().optional(),
  round: z.number().int().optional(),
  createdAt: z.number(),
})
export type CommentReply = z.infer<typeof CommentReplySchema>

/**
 * A stored comment = the root of a review thread, with its replies (oldest first). `round` is the review round that
 * delivered the root; absent = pending (not sent yet). Delivered threads are kept until deleted or cleared as
 * resolved. Timestamps are epoch ms.
 */
export const CommentSchema = CommentInputBaseSchema.extend({
  id: z.string(),
  status: z.enum(COMMENT_STATUSES),
  round: z.number().int().optional(),
  resolvedAt: z.number().optional(),
  replies: z.array(CommentReplySchema),
  createdAt: z.number(),
  updatedAt: z.number(),
})
export type Comment = z.infer<typeof CommentSchema>

/** A stored comment's anchor, as the composer's `context` (to reopen it in edit mode where it was written). */
export function commentContextOf(c: Comment): CommentContext {
  const { source, filePath, lineStart, lineEnd, diffSide, snippet, language, element } = c
  return { source, filePath, lineStart, lineEnd, diffSide, snippet, language, element }
}
