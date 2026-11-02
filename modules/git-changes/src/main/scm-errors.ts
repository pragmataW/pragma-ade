import { SCM_ERROR_CODES, type ScmErrorCode, type ScmResult } from '../contract'

const [GIT_FAILED] = SCM_ERROR_CODES

/** First match wins; git's English messages (projects runs git with `LC_ALL=C`). */
const RULES: readonly [RegExp, ScmErrorCode][] = [
  [
    /could not read (?:Username|Password)|Authentication failed|terminal prompts disabled|Permission denied \(publickey/i,
    'authFailed',
  ],
  [/\[rejected\]|non-fast-forward|fetch first|Updates were rejected/, 'nonFastForward'],
  [/would be overwritten/, 'localChanges'],
  [/CONFLICT|Merge conflict|could not apply|needs merge|conflicts/, 'conflict'],
  [/no tracking information|has no upstream/, 'noUpstream'],
  [
    /No configured push destination|does not appear to be a git repository|No remote repository specified|No such remote/,
    'noRemote',
  ],
  [/nothing to commit|no changes added to commit|nothing added to commit/, 'nothingToCommit'],
]

export const OK: ScmResult = { ok: true }

export const scmFailure = (code: ScmErrorCode, detail = ''): ScmResult => ({ ok: false, code, detail })

/** A failed git call's output as an `ScmResult` (code by message, detail = the trimmed output). */
export function classifyFailure(output: string): ScmResult {
  const detail = output.trim()
  return scmFailure(RULES.find(([re]) => re.test(detail))?.[1] ?? GIT_FAILED, detail)
}
