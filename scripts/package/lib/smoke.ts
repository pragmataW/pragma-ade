import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  DARWIN,
  DIST_DIR,
  PARENT_SEGMENT,
  PLAYWRIGHT_STATUS,
  PNPM,
  SKIP_ANNOTATION,
  SMOKE_CONFIG,
  SMOKE_DIST_ENV,
  SMOKE_RESULTS_FILE,
  SMOKE_TIMEOUT_MS,
  STATUS,
  UTF8,
} from '../constants.ts'
import { doctor } from './doctor.ts'
import { run } from './exec.ts'
import { readManifest, writeManifest } from './report.ts'
import { type DistManifest, PwReportSchema, type PwSuite, type SmokeSummary } from './schema.ts'
import { TARGET_IDS, TARGETS } from './targets.ts'

/** The repo that holds the smoke test and Playwright (this tool's repo, not `--repo`). */
const TOOL_REPO = resolve(import.meta.dirname, PARENT_SEGMENT, PARENT_SEGMENT, PARENT_SEGMENT)

function* specsOf(suite: PwSuite, prefix: string): Generator<[string, PwSuite['specs'][number]]> {
  const title = prefix ? `${prefix} › ${suite.title}` : suite.title
  for (const spec of suite.specs) yield [`${title} › ${spec.title}`, spec]
  for (const child of suite.suites) yield* specsOf(child, title)
}

type PwTest = PwSuite['specs'][number]['tests'][number]

function addTest(summary: SmokeSummary, name: string, t: PwTest): void {
  const last = t.results.at(-1)
  const status = last?.status ?? PLAYWRIGHT_STATUS.skipped
  if (status === PLAYWRIGHT_STATUS.passed) {
    summary.passed++
    return
  }
  if (status === PLAYWRIGHT_STATUS.skipped) {
    const reason = t.annotations.find((a) => a.type === SKIP_ANNOTATION)?.description ?? ''
    summary.skipped.push({ title: name, reason })
    return
  }
  summary.failed++
  summary.failures.push({ title: name, error: last?.error?.message?.split('\n')[0] ?? status })
}

/** Playwright JSON report → passed/failed counts and skip reasons. */
export function summarizeSmoke(report: unknown): SmokeSummary {
  const summary: SmokeSummary = { passed: 0, failed: 0, skipped: [], failures: [] }
  for (const suite of PwReportSchema.parse(report).suites)
    for (const [title, spec] of specsOf(suite, ''))
      for (const t of spec.tests) addTest(summary, `[${t.projectName ?? ''}] ${title}`, t)
  return summary
}

/** Runs the packaged macOS smoke test for every built darwin target (x64 only with Rosetta). */
export async function runSmoke(repoRoot: string): Promise<DistManifest> {
  const distDir = join(repoRoot, DIST_DIR)
  const manifest = readManifest(distDir)
  if (!manifest) throw new Error(`no ${distDir}/manifest.json; run build first`)
  const host = await doctor({ repoRoot })
  const projects = TARGET_IDS.filter(
    (id) =>
      TARGETS[id].platform === DARWIN &&
      manifest.targets[id]?.status === STATUS.ok &&
      (TARGETS[id].arch === process.arch || host.rosetta),
  )
  if (projects.length === 0) throw new Error('no darwin target was built successfully; nothing to smoke-test')
  const args = ['exec', 'playwright', 'test', '-c', SMOKE_CONFIG, ...projects.flatMap((p) => ['--project', p])]
  await run(PNPM, args, {
    cwd: TOOL_REPO,
    allowFail: true,
    timeoutMs: SMOKE_TIMEOUT_MS,
    env: { ...process.env, [SMOKE_DIST_ENV]: distDir },
    onLine: (l) => console.log(`  ${l}`),
  })
  const results = join(distDir, SMOKE_RESULTS_FILE)
  const smoke = existsSync(results)
    ? summarizeSmoke(JSON.parse(readFileSync(results, UTF8)))
    : { passed: 0, failed: 1, skipped: [], failures: [{ title: 'smoke', error: `no ${results}` }] }
  return writeManifest(distDir, { ...manifest, targets: {}, smoke })
}
