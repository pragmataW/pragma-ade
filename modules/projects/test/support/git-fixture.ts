import { execFileSync } from 'node:child_process'
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createFixtureRepo, createTempUserData, isolatedGitEnv } from '@pragma/test-support'

export interface FixtureRepo {
  /** Realpath of the working tree (macOS `/var` → `/private/var`). */
  dir: string
  git(...args: string[]): Promise<string>
  write(rel: string, content: string): Promise<void>
  commitAll(msg: string): Promise<void>
  cleanup(): void
}

const README = 'README.md'
const README_TEXT = '# fixture\n'

/** Realpath (macOS `/var` → `/private/var`). */
export const canonical = (p: string): string => realpathSync.native(p)

/** Isolation-only git env (no global/system config, fixed author); merged over `process.env` by callers. */
export function gitTestEnv(): Record<string, string> {
  const env = isolatedGitEnv()
  const out: Record<string, string> = {}
  for (const key of Object.keys(env)) if (key.startsWith('GIT_')) out[key] = env[key] as string
  return out
}

function gitAt(cwd: string) {
  return async (...args: string[]): Promise<string> =>
    execFileSync('git', args, {
      cwd,
      env: isolatedGitEnv(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
}

function wrap(dir: string, cleanup: () => void): FixtureRepo {
  const git = gitAt(dir)
  return {
    dir,
    git,
    async write(rel, content) {
      const file = join(dir, rel)
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, content)
    },
    async commitAll(msg) {
      await git('add', '-A')
      await git('commit', '--allow-empty', '-m', msg)
    },
    cleanup,
  }
}

/** A temp repo (`git init -b <branch|main>`) with one commit containing README.md (+ `files`). */
export async function makeRepo(opts: { branch?: string; files?: Record<string, string> } = {}): Promise<FixtureRepo> {
  const repo = createFixtureRepo({ branch: opts.branch, files: { [README]: README_TEXT, ...opts.files } })
  return wrap(realpathSync.native(repo.path), repo.cleanup)
}

/** `git clone [--bare]` of `origin` into a fresh temp dir. */
export async function makeClone(origin: FixtureRepo, opts: { bare?: boolean } = {}): Promise<FixtureRepo> {
  const temp = createTempUserData()
  const dir = join(realpathSync.native(temp.path), 'clone')
  await gitAt(temp.path)('clone', ...(opts.bare ? ['--bare'] : []), origin.dir, dir)
  return wrap(dir, temp.cleanup)
}

/** A plain (non-git) temp directory. */
export function makePlainDir(): { dir: string; cleanup(): void } {
  const temp = createTempUserData()
  const dir = realpathSync.native(temp.path)
  writeFileSync(join(dir, README), README_TEXT)
  return { dir, cleanup: temp.cleanup }
}
