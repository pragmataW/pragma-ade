import { existsSync, realpathSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import {
  BRANCH_CHECKED_OUT_RE,
  COMMIT_PEEL,
  DOT_GIT,
  ENOENT,
  FALLBACK_BASE_BRANCHES,
  GIT_ARGS,
  GIT_BINARY,
  GIT_ENV,
  GIT_ENV_OFF,
  GIT_FLAGS,
  GIT_GLOBAL_ARGS,
  GIT_LOCALE,
  GIT_TRUE,
  HEAD,
  MERGE_BASE_NONE_EXIT,
  NEWLINE,
  ORIGIN_PREFIX,
  PATH_EXISTS_RE,
  REF_PREFIXES,
} from '../../constants'
import {
  type GitRunOptions,
  type GitRunResult,
  type GitService,
  PROJECTS_ERROR,
  ProjectsError,
  type ResolvedRepo,
} from '../../contract'
import { parseBranchList, parseStatusV2, parseWorktreeList } from './parse'
import { defaultExec, type ExecFn } from './run'

export interface GitServiceOptions {
  gitBinary?: string
  /** Extra variables over `process.env` for every call (tests pass an isolated git config). */
  baseEnv?: Record<string, string>
  exec?: ExecFn
}

const ALLOW = { allowFailure: true } as const
const STATUS_ENV = { [GIT_ENV.optionalLocks]: GIT_ENV_OFF }
const FIXED_ENV = { [GIT_ENV.terminalPrompt]: GIT_ENV_OFF, [GIT_ENV.lcAll]: GIT_LOCALE }
const ORIGIN_REF_PREFIX = `${REF_PREFIXES.remotes}${ORIGIN_PREFIX}`

const realpath = (p: string): string => realpathSync.native(p)
const isEnoent = (e: unknown): boolean => (e as { code?: unknown }).code === ENOENT
const definedEntry = (e: [string, string | undefined]): e is [string, string] => e[1] !== undefined
const processEnv = (): Record<string, string> => Object.fromEntries(Object.entries(process.env).filter(definedEntry))
const lines = (s: string): string[] => s.split(NEWLINE).map((l) => l.trim())

/** Maps `git worktree add` stderr to the module's error codes. */
function worktreeAddError(stderr: string): ProjectsError {
  const detail = stderr.trim()
  if (BRANCH_CHECKED_OUT_RE.test(stderr)) return new ProjectsError(PROJECTS_ERROR.branchCheckedOut, detail)
  if (PATH_EXISTS_RE.test(stderr)) return new ProjectsError(PROJECTS_ERROR.pathExists, detail)
  return new ProjectsError(PROJECTS_ERROR.gitFailed, detail)
}

type Run = (cwd: string, args: readonly string[], o?: GitRunOptions) => Promise<GitRunResult>

function createRunner(opts: GitServiceOptions): Run {
  const exec = opts.exec ?? defaultExec
  const binary = opts.gitBinary ?? GIT_BINARY
  return async (cwd, args, o = {}) => {
    if (!existsSync(cwd)) throw new ProjectsError(PROJECTS_ERROR.pathNotFound, cwd)
    const env = { ...processEnv(), ...opts.baseEnv, ...FIXED_ENV, ...o.env }
    let result: GitRunResult
    try {
      result = await exec(binary, [...GIT_GLOBAL_ARGS, ...args], { cwd, env, input: o.input, timeoutMs: o.timeoutMs })
    } catch (e) {
      if (isEnoent(e)) throw new ProjectsError(PROJECTS_ERROR.gitNotFound, binary)
      throw e
    }
    if (result.exitCode !== 0 && !o.allowFailure)
      throw new ProjectsError(PROJECTS_ERROR.gitFailed, result.stderr.trim() || args.join(' '))
    return result
  }
}

/** The git CLI behind `GitServiceToken` (§7). */
export function createGitService(opts: GitServiceOptions = {}): GitService {
  const run = createRunner(opts)
  const ok = async (cwd: string, args: readonly string[]) => (await run(cwd, args, ALLOW)).exitCode === 0
  const out = async (cwd: string, args: readonly string[]) => (await run(cwd, args)).stdout.trim()
  const refExists = (cwd: string, ref: string) => ok(cwd, [...GIT_ARGS.verifyCommit, `${ref}${COMMIT_PEEL}`])
  const hasLocal = (cwd: string, branch: string) => refExists(cwd, `${REF_PREFIXES.heads}${branch}`)

  async function originHeadBranch(repoPath: string): Promise<string | null> {
    const r = await run(repoPath, GIT_ARGS.originHead, ALLOW)
    if (r.exitCode !== 0) return null
    const name = r.stdout.trim().slice(ORIGIN_REF_PREFIX.length)
    return (await hasLocal(repoPath, name)) ? name : `${ORIGIN_PREFIX}${name}`
  }

  async function resolveRepo(path: string): Promise<ResolvedRepo | null> {
    if (!existsSync(path)) return null
    const dir = realpath(path)
    const bare = await run(dir, GIT_ARGS.isBare, ALLOW)
    if (bare.exitCode !== 0) return null
    if (bare.stdout.trim() === GIT_TRUE)
      return { repoPath: realpath(await out(dir, GIT_ARGS.absoluteGitDir)), isBare: true }
    const common = await out(dir, GIT_ARGS.commonDir)
    if (basename(common) === DOT_GIT) return { repoPath: realpath(dirname(common)), isBare: false }
    return { repoPath: realpath(await out(dir, GIT_ARGS.topLevel)), isBare: false }
  }

  return {
    run,
    status: async (cwd) => parseStatusV2((await run(cwd, GIT_ARGS.status, { env: STATUS_ENV })).stdout),
    async mergeBase(cwd, a, b) {
      const r = await run(cwd, [...GIT_ARGS.mergeBase, a, b], ALLOW)
      if (r.exitCode === MERGE_BASE_NONE_EXIT) return null
      if (r.exitCode !== 0) throw new ProjectsError(PROJECTS_ERROR.gitFailed, r.stderr.trim())
      return r.stdout.trim()
    },
    async show(cwd, rev, path) {
      const r = await run(cwd, [...GIT_ARGS.show, `${rev}:${path}`], ALLOW)
      return r.exitCode === 0 ? r.stdout : null
    },
    async defaultBaseBranch(repoPath) {
      const origin = await originHeadBranch(repoPath)
      if (origin) return origin
      for (const b of FALLBACK_BASE_BRANCHES) if (await hasLocal(repoPath, b)) return b
      const current = await run(repoPath, GIT_ARGS.currentBranch, ALLOW)
      return current.exitCode === 0 ? current.stdout.trim() : HEAD
    },
    resolveRepo,
    async gitDirs(worktreePath) {
      const [gitDir = '', commonDir = ''] = lines(await out(worktreePath, GIT_ARGS.gitDirs))
      return { gitDir: realpath(gitDir), commonDir: realpath(commonDir) }
    },
    worktreeList: async (repoPath) => parseWorktreeList((await run(repoPath, GIT_ARGS.worktreeList)).stdout),
    async worktreeAdd(repoPath, o) {
      const args = o.newBranch
        ? [...GIT_ARGS.worktreeAdd, GIT_FLAGS.newBranch, o.branch, o.path, ...(o.startPoint ? [o.startPoint] : [])]
        : [...GIT_ARGS.worktreeAdd, o.path, o.branch]
      const r = await run(repoPath, args, ALLOW)
      if (r.exitCode !== 0) throw worktreeAddError(r.stderr)
    },
    async worktreeRemove(repoPath, path, o) {
      await run(repoPath, [...GIT_ARGS.worktreeRemove, ...(o.force ? [GIT_FLAGS.force] : []), path])
    },
    async worktreePrune(repoPath) {
      await run(repoPath, GIT_ARGS.worktreePrune)
    },
    branchList: async (repoPath) => parseBranchList((await run(repoPath, GIT_ARGS.branchList)).stdout),
    async branchDelete(repoPath, branch, o) {
      await run(repoPath, [...GIT_ARGS.branchDelete, o.force ? GIT_FLAGS.deleteForce : GIT_FLAGS.deleteMerged, branch])
    },
    isValidBranchName: (repoPath, name) => ok(repoPath, [...GIT_ARGS.checkBranchName, name]),
    refExists,
    countCommits: async (cwd, from, to) => Number(await out(cwd, [...GIT_ARGS.countCommits, `${from}..${to}`])),
  }
}
