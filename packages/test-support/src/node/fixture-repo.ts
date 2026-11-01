import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DEFAULT_BRANCH, GIT_AUTHOR, NULL_DEVICE, UTF8 } from './constants'
import { createTempUserData } from './temp-user-data'

export interface FixtureRepo {
  path: string
  git(...args: string[]): string
  /** Writes `files` (if any), stages everything and commits; returns the new sha. */
  commit(message: string, files?: Record<string, string>): string
  cleanup(): void
}

const GIT = 'git'
const GIT_STDIO: ['ignore', 'pipe', 'pipe'] = ['ignore', 'pipe', 'pipe']

/** Git env that ignores the user's global/system config. */
export const isolatedGitEnv = (): NodeJS.ProcessEnv => ({
  ...process.env,
  GIT_CONFIG_GLOBAL: NULL_DEVICE,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: GIT_AUTHOR.name,
  GIT_AUTHOR_EMAIL: GIT_AUTHOR.email,
  GIT_COMMITTER_NAME: GIT_AUTHOR.name,
  GIT_COMMITTER_EMAIL: GIT_AUTHOR.email,
})

export function writeFiles(root: string, files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    const file = join(root, rel)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, content)
  }
}

/** A temporary git repository with an isolated author (`Pragma Test <test@pragma.invalid>`). */
export function createFixtureRepo(opts: { files?: Record<string, string>; branch?: string; commit?: boolean } = {}) {
  const temp = createTempUserData()
  const env = isolatedGitEnv()
  const git = (...args: string[]): string =>
    execFileSync(GIT, args, { cwd: temp.path, env, encoding: UTF8, stdio: GIT_STDIO }).trim()
  git('init', '-b', opts.branch ?? DEFAULT_BRANCH)
  const commit = (message: string, files: Record<string, string> = {}): string => {
    writeFiles(temp.path, files)
    git('add', '-A')
    git('commit', '--allow-empty', '-m', message)
    return git('rev-parse', 'HEAD')
  }
  writeFiles(temp.path, opts.files ?? {})
  if (opts.commit !== false) commit('initial')
  const repo: FixtureRepo = { path: temp.path, git, commit, cleanup: temp.cleanup }
  return repo
}
