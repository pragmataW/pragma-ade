import { defineBridgeNamespace } from '@pragma/module-bridge/contract'
import { COMMENT_SOURCES, COMMENT_STATUSES, REPLY_AUTHORS } from '@pragma/module-comments/contract'

/** Thread vocabulary of the comments module, re-exported for the extension (it bundles only this contract). */
export {
  COMMENT_STATUS as THREAD_STATUS,
  type CommentStatus as ThreadStatus,
  REPLY_AUTHOR,
} from '@pragma/module-comments/contract'

import { z } from '@pragma/sdk'
import { THEME_MODES } from '@pragma/ui/tokens'
import {
  CASE_INSENSITIVE_PLATFORMS,
  COMMENT_ACTIONS,
  COMMENT_REPLY,
  EDITOR_MODULE_ID,
  LANGUAGE_STATES,
  PATH_SEP,
  TEST_OPS,
} from './constants'

const line = () => z.number().int().min(1)
const count = () => z.number().int().min(0)

export const EditorThemeSchema = z.object({
  themeName: z.string(),
  mode: z.enum(THEME_MODES),
  /**
   * Colour theme name → palette tokens. Written as `[<theme>]` blocks of `workbench.colorCustomizations`, so the
   * palette always matches the active colour theme and a mode switch is one `workbench.colorTheme` write.
   */
  colorsByTheme: z.record(z.string(), z.record(z.string(), z.string())).optional(),
  /**
   * Colour theme per mode. When set, the workbench follows the view's `prefers-color-scheme` (the app drives
   * `nativeTheme.themeSource`), so a mode switch writes no setting; without it `themeName` is pinned (an override).
   */
  themeMap: z.object({ dark: z.string(), light: z.string() }).optional(),
  /** Grows with every app theme change; an extension drops a message older than one it already took. */
  rev: z.number().int().min(0).optional(),
})
export const EditorHelloSchema = z.object({
  folderKey: z.string(),
  folderPath: z.string(),
  extensionVersion: z.string(),
})
export const EditorHelloReplySchema = z.object({
  known: z.boolean(),
  worktreeId: z.string().nullable(),
  theme: EditorThemeSchema,
})
export const EditorCommentSchema = z.object({
  action: z.enum(COMMENT_ACTIONS),
  filePath: z.string(),
  lineStart: line(),
  lineEnd: line(),
  snippet: z.string(),
  language: z.string().optional(),
  body: z.string().min(1),
})
const commentId = z.object({ commentId: z.string() })
const REPLY_KEY = 'status'
export const EditorCommentReplySchema = z.discriminatedUnion(REPLY_KEY, [
  commentId.extend({ status: z.literal(COMMENT_REPLY.drafted) }),
  commentId.extend({ status: z.literal(COMMENT_REPLY.sent) }),
  /** The comments module shows its target picker / start-agent flow. */
  commentId.extend({ status: z.literal(COMMENT_REPLY.needsUserAction) }),
  /** `commentId` when the draft was stored before the send failed (it stays as a Pending draft). */
  z.object({ status: z.literal(COMMENT_REPLY.failed), message: z.string(), commentId: z.string().optional() }),
])
/** What a Send from the editor did (the worktree's whole review round). */
export const EditorSendReplySchema = z.discriminatedUnion(REPLY_KEY, [
  z.object({ status: z.literal(COMMENT_REPLY.sent) }),
  z.object({ status: z.literal(COMMENT_REPLY.needsUserAction) }),
  z.object({ status: z.literal(COMMENT_REPLY.failed), message: z.string() }),
])
/** One reply of a review thread; `label` = the agent's profile name (null for the user or an unknown agent). */
export const EditorThreadReplySchema = z.object({
  id: z.string(),
  author: z.enum(REPLY_AUTHORS),
  label: z.string().nullable(),
  body: z.string(),
  /** A user reply no Send delivered yet. */
  pending: z.boolean(),
})
/**
 * A review thread on code as the workbench draws it: editor comments and the diff's new-side comments of the
 * client's worktree (the same threads Git Changes and the drawer show).
 */
export const EditorThreadSchema = z.object({
  id: z.string(),
  source: z.enum(COMMENT_SOURCES),
  filePath: z.string(),
  lineStart: line(),
  lineEnd: line(),
  status: z.enum(COMMENT_STATUSES),
  /** The root was not sent yet. */
  pending: z.boolean(),
  body: z.string(),
  replies: z.array(EditorThreadReplySchema),
})
/** Every code thread of the client's worktree (oldest first); the extension replaces what it shows with it. */
export const EditorThreadsSchema = z.object({ threads: z.array(EditorThreadSchema) })
const threadRef = z.object({ threadId: z.string().min(1) })
/** A user reply from the workbench; `send` also sends the worktree's review round. */
export const EditorThreadReplyInputSchema = threadRef.extend({ body: z.string().min(1), send: z.boolean() })
export const EditorThreadStatusInputSchema = threadRef.extend({ status: z.enum(COMMENT_STATUSES) })
export const EditorOpenFileMsgSchema = z.object({
  path: z.string(),
  line: line().optional(),
  column: line().optional(),
})
/** Two git revisions to compare (`git:` URIs); absent = the working-tree change git lists for the file. */
export const DiffRefsSchema = z.object({ old: z.string().min(1), new: z.string().min(1) })
export const EditorOpenDiffMsgSchema = z.object({
  path: z.string(),
  /** The old side's path of a rename (refs diffs only; the SCM change knows its own). */
  oldPath: z.string().optional(),
  refs: DiffRefsSchema.optional(),
  line: line().optional(),
})
export const EditorSetThemeMsgSchema = EditorThemeSchema
export const EditorLanguageStatusSchema = z.object({
  languageId: z.string().nullable(),
  state: z.enum(LANGUAGE_STATES),
  errors: count(),
  warnings: count(),
})
export const EditorTestRequestSchema = z.object({ requestId: z.string(), op: z.enum(TEST_OPS), args: z.unknown() })
export const EditorTestResponseSchema = z.object({
  requestId: z.string(),
  result: z.unknown().optional(),
  error: z.string().optional(),
})

export type EditorTheme = z.infer<typeof EditorThemeSchema>
export type EditorHello = z.infer<typeof EditorHelloSchema>
export type EditorHelloReply = z.infer<typeof EditorHelloReplySchema>
export type EditorComment = z.infer<typeof EditorCommentSchema>
export type EditorCommentReply = z.infer<typeof EditorCommentReplySchema>
export type EditorSendReply = z.infer<typeof EditorSendReplySchema>
export type EditorThreadReply = z.infer<typeof EditorThreadReplySchema>
export type EditorThread = z.infer<typeof EditorThreadSchema>
export type EditorThreads = z.infer<typeof EditorThreadsSchema>
export type EditorThreadReplyInput = z.infer<typeof EditorThreadReplyInputSchema>
export type EditorThreadStatusInput = z.infer<typeof EditorThreadStatusInputSchema>
export type EditorOpenFileMsg = z.infer<typeof EditorOpenFileMsgSchema>
export type DiffRefs = z.infer<typeof DiffRefsSchema>
export type EditorOpenDiffMsg = z.infer<typeof EditorOpenDiffMsgSchema>
export type EditorSetThemeMsg = z.infer<typeof EditorSetThemeMsgSchema>
export type EditorLanguageStatus = z.infer<typeof EditorLanguageStatusSchema>
export type EditorTestRequest = z.infer<typeof EditorTestRequestSchema>
export type EditorTestResponse = z.infer<typeof EditorTestResponseSchema>

/** The `editor` bridge namespace (§4.8): requests from the extension, events to it. */
export const editorBridge = defineBridgeNamespace({
  name: EDITOR_MODULE_ID,
  requests: {
    hello: { input: EditorHelloSchema, output: EditorHelloReplySchema },
    comment: { input: EditorCommentSchema, output: EditorCommentReplySchema },
    testResponse: { input: EditorTestResponseSchema, output: z.null() },
    languageStatus: { input: EditorLanguageStatusSchema, output: z.null() },
    /** Asked after every hello: the review threads to show. */
    threads: { input: z.object({}), output: EditorThreadsSchema },
    reply: { input: EditorThreadReplyInputSchema, output: EditorCommentReplySchema },
    setStatus: { input: EditorThreadStatusInputSchema, output: z.null() },
    deleteThread: { input: threadRef, output: z.null() },
    /** Sends every pending item of the client's worktree (one review round). */
    send: { input: z.object({}), output: EditorSendReplySchema },
  },
  events: {
    /** Sent to one client (`BridgeServer.send(clientId)`). */
    openFile: EditorOpenFileMsgSchema,
    /** Sent to one client: the file's git diff in the workbench. */
    openDiff: EditorOpenDiffMsgSchema,
    /** Broadcast to every `editor` subscriber. */
    setTheme: EditorSetThemeMsgSchema,
    /** Sent to one client, test mode only. */
    testRequest: EditorTestRequestSchema,
    /** Sent to every client of a worktree whose comments changed. */
    threads: EditorThreadsSchema,
  },
})
export type EditorBridgeEvent = keyof typeof editorBridge.events

const BACKSLASH_RE = /\\/g
const DRIVE_RE = /^[A-Za-z]:$/
const CURRENT = '.'
const PARENT = '..'

const hostPlatform = (): string | undefined => (globalThis as { process?: { platform?: string } }).process?.platform

/** Resolves `.`/`..` segments of a `/`-separated path (keeps a leading `/` or drive). */
function resolveSegments(path: string): string {
  const absolute = path.startsWith(PATH_SEP)
  const out: string[] = []
  for (const seg of path.split(PATH_SEP)) {
    if (seg === '' || seg === CURRENT) continue
    if (seg === PARENT) {
      if (out.length > 0 && !DRIVE_RE.test(out[out.length - 1] ?? '')) out.pop()
      continue
    }
    out.push(seg)
  }
  return `${absolute ? PATH_SEP : ''}${out.join(PATH_SEP)}`
}

/** The key a workspace folder is known by: `\` → `/`, `.`/`..` resolved, no trailing `/`, lower-case on darwin/win32. */
export function normalizeFolderKey(p: string, platform: string | undefined = hostPlatform()): string {
  const resolved = resolveSegments(p.replace(BACKSLASH_RE, PATH_SEP))
  const insensitive = (CASE_INSENSITIVE_PLATFORMS as readonly (string | undefined)[]).includes(platform)
  return insensitive ? resolved.toLowerCase() : resolved
}
