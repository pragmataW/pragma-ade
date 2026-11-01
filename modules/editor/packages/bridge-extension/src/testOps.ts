import { resolve } from 'node:path'
import { type CommentAction, type EditorTestRequest, TEST_OP, type TestOp } from '@pragma/module-editor/contract'
import type { BridgeConnection } from './bridgeConnection'
import type { ReplyLike } from './comments/controller'
import { TEST_ARG as A, FILE_SCHEME, TEST_RESPONSE } from './constants'
import type { VscodeApi } from './vscodeApi'

type Args = Record<string, unknown>
type Op = (args: Args) => unknown

const str = (a: Args, k: string): string => String(a[k] ?? '')
const num = (a: Args, k: string): number => Number(a[k])

/** Test-mode operations the E2E drives through `editor.testRequest` (only wired when `PRAGMA_TEST=1`). */
export function createTestOps(
  api: VscodeApi,
  o: { folderPath: () => string; handleComment(reply: ReplyLike, action: CommentAction): Promise<void> },
): Record<TestOp, Op> {
  const abs = (p: string): string => resolve(o.folderPath(), p)
  return {
    [TEST_OP.diagnostics]: (a) => api.diagnostics(abs(str(a, A.path))),
    [TEST_OP.executeCommand]: (a) => api.executeCommand(str(a, A.id), (a.args as unknown[] | undefined) ?? []),
    [TEST_OP.tabs]: () => api.tabs(),
    [TEST_OP.extensionActive]: (a) => api.extensionActive(str(a, A.id)),
    [TEST_OP.activeEditor]: () => api.activeEditor(),
    [TEST_OP.addComment]: async (a) => {
      const added: string[] = []
      const thread = {
        uri: { scheme: FILE_SCHEME, fsPath: abs(str(a, A.path)) },
        range: { startLine: num(a, A.lineStart) - 1, endLine: num(a, A.lineEnd) - 1 },
        addComment: (body: string) => void added.push(body),
        dispose: () => undefined,
      }
      await o.handleComment({ thread, text: str(a, A.body) }, a.action as CommentAction)
      return { notSent: added }
    },
  }
}

const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/** Runs one request and answers with `editor.testResponse`. */
export async function answerTestRequest(
  ops: Record<TestOp, Op>,
  conn: Pick<BridgeConnection, 'request'>,
  m: EditorTestRequest,
): Promise<void> {
  try {
    const result = await ops[m.op]((m.args as Args | null) ?? {})
    await conn.request(TEST_RESPONSE, { requestId: m.requestId, result: result ?? null })
  } catch (error) {
    await conn.request(TEST_RESPONSE, { requestId: m.requestId, error: errorText(error) })
  }
}
