/** Test helpers for this and other modules' tests (`@pragma/module-git-changes/testing`, test code only). */
import { execFile } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createFixtureRepo, type FixtureRepo, isolatedGitEnv } from '@pragma/test-support'
import type { GitPort } from '../src/main/diff-service'

export * from './fake-main-ctx'

const GIT_MAX_BUFFER = 64 * 1024 * 1024

/** A `GitPort` over the `git` CLI with the projects semantics: untrimmed stdout, throws unless `allowFailure`. */
export function execGitPort(): GitPort {
  const env = isolatedGitEnv()
  const run: GitPort['run'] = (cwd, args, opts = {}) =>
    new Promise((resolve, reject) => {
      execFile('git', args, { cwd, env, encoding: 'utf8', maxBuffer: GIT_MAX_BUFFER }, (error, stdout, stderr) => {
        const exitCode = error ? Number(error.code ?? 1) : 0
        if (exitCode !== 0 && !opts.allowFailure) reject(new Error(`git ${args.join(' ')}: ${stderr}`))
        else resolve({ stdout, stderr, exitCode })
      })
    })
  const allow = { allowFailure: true }
  return {
    run,
    async mergeBase(cwd, a, b) {
      const r = await run(cwd, ['merge-base', a, b], allow)
      return r.exitCode === 0 ? r.stdout.trim() : null
    },
    async show(cwd, rev, path) {
      const r = await run(cwd, ['show', `${rev}:${path}`], allow)
      return r.exitCode === 0 ? r.stdout : null
    },
    countCommits: async (cwd, from, to) => Number((await run(cwd, ['rev-list', '--count', `${from}..${to}`])).stdout),
  }
}

export interface StandardFixture {
  repo: FixtureRepo
  write(rel: string, data: string | Buffer): Promise<void>
  rm(rel: string): Promise<void>
}

/** Expected path lists of the standard fixture, shared by unit and E2E tests. */
export const STANDARD_EXPECT = {
  uncommitted: ['README.md', 'assets/logo.png', 'notes/todo.txt', 'src/app.ts'],
  branchVsMain: ['docs/added.md', 'long.ts', 'new-name.txt', 'remove-me.txt', 'src/main/git/service.ts'],
  branchVsDevelop: ['new-name.txt', 'remove-me.txt', 'src/main/git/service.ts'],
} as const

const LONG_LINES = 200
const APP_LINES = 20
const CHANGED_LONG_LINE = 100
const CHANGED_APP_LINES = [10, 11, 12]
const numbered = (n: number, text: (i: number) => string): string =>
  Array.from({ length: n }, (_, i) => `${text(i + 1)}\n`).join('')

/** Line `i` (1-based) of long.ts on `feature` and of the uncommitted src/app.ts. */
export const fixtureLongLine = (i: number): string =>
  i === CHANGED_LONG_LINE ? 'line 100 changed' : `line ${i} unchanged`
export const fixtureAppLine = (i: number): string => (CHANGED_APP_LINES.includes(i) ? `app ${i} edited` : `app ${i}`)
const LOGO_V1 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3])
const LOGO_V2 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 9, 8, 7, 6])

function fixtureIo(repo: FixtureRepo): Omit<StandardFixture, 'repo'> {
  return {
    async write(rel, data) {
      const file = join(repo.path, rel)
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, data)
    },
    rm: (rel) => rm(join(repo.path, rel), { recursive: true, force: true }),
  }
}

/**
 * `main`: README, src/app.ts, old-name.txt, remove-me.txt, long.ts, src/main/git/service.ts, assets/logo.png.
 * `feature` (checked out): commit 1 edits long.ts line 100 and adds docs/added.md (`develop` points here); commit 2
 * renames old-name.txt → new-name.txt, removes remove-me.txt and edits service.ts. Uncommitted: README staged,
 * src/app.ts lines 10–12, logo.png rewritten, untracked notes/todo.txt (2 lines).
 */
export async function buildStandardFixture(): Promise<StandardFixture> {
  const repo = createFixtureRepo({
    commit: false,
    files: {
      'README.md': '# fixture\n',
      'src/app.ts': numbered(APP_LINES, (i) => `app ${i}`),
      'old-name.txt': 'this file gets renamed\nwithout changing its contents\n',
      'remove-me.txt': 'this file gets removed\n',
      'long.ts': numbered(LONG_LINES, (i) => `line ${i} unchanged`),
      'src/main/git/service.ts': 'export const service = 1\n',
    },
  })
  const io = fixtureIo(repo)
  await io.write('assets/logo.png', LOGO_V1)
  repo.commit('initial')
  repo.git('checkout', '-q', '-b', 'feature')
  repo.commit('feature 1', { 'long.ts': numbered(LONG_LINES, fixtureLongLine), 'docs/added.md': '# Added\n' })
  repo.git('branch', 'develop')
  repo.git('mv', 'old-name.txt', 'new-name.txt')
  repo.git('rm', '-q', 'remove-me.txt')
  repo.commit('feature 2', { 'src/main/git/service.ts': 'export const service = 2\n' })
  await io.write('README.md', '# fixture\n\nstaged change\n')
  repo.git('add', 'README.md')
  await io.write('src/app.ts', numbered(APP_LINES, fixtureAppLine))
  await io.write('assets/logo.png', LOGO_V2)
  await io.write('notes/todo.txt', 'first\nsecond\n')
  return { repo, ...io }
}

/** A repository without commits, with the same write/rm helpers. */
export function buildEmptyFixture(): StandardFixture {
  const repo = createFixtureRepo({ commit: false })
  return { repo, ...fixtureIo(repo) }
}
