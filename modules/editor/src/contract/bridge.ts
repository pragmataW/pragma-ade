import { defineBridgeNamespace } from '@pragma/module-bridge/contract'
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
  colors: z.record(z.string(), z.string()).optional(),
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
export const EditorCommentReplySchema = z.discriminatedUnion('status', [
  commentId.extend({ status: z.literal(COMMENT_REPLY.drafted) }),
  commentId.extend({ status: z.literal(COMMENT_REPLY.sent) }),
  /** The comments module shows its target picker / start-agent flow. */
  commentId.extend({ status: z.literal(COMMENT_REPLY.needsUserAction) }),
  z.object({ status: z.literal(COMMENT_REPLY.failed), message: z.string() }),
])
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
