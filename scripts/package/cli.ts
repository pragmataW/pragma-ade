import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ARGV_USER_START,
  CMD,
  COMMANDS,
  DOCTOR_LABEL_WIDTH,
  EXIT,
  FLAGS,
  JSON_INDENT,
  NODE_MODULES,
  NPM,
  PARENT_SEGMENT,
  TOOL_DEP_MARKER,
} from './constants.ts'
import { doctor } from './lib/doctor.ts'
import { run } from './lib/exec.ts'
import { auditTargets, type BuildOptions, buildTargets } from './lib/pipeline.ts'
import { exitCodeFor } from './lib/report.ts'
import { runSmoke } from './lib/smoke.ts'
import { isTargetSpec, parseTargets, TARGET_IDS, type TargetId } from './lib/targets.ts'

export type Command = (typeof COMMANDS)[number]

export interface CliArgs {
  command: Command
  targets: TargetId[]
  skipAppBuild: boolean
  dockerAutoStart: boolean
  keepStage: boolean
  deep: boolean
  repo: string
  json: boolean
}

const TOOL_DIR = import.meta.dirname
const DEFAULT_REPO = resolve(TOOL_DIR, PARENT_SEGMENT, PARENT_SEGMENT)
const isCommand = (s: string): s is Command => (COMMANDS as readonly string[]).includes(s)

/** `<command> [targets…] [flags]`; a leading target spec means `build` (root `package:*` scripts pass only targets). */
export function parseArgs(argv: readonly string[]): CliArgs {
  const [first = '', ...rest] = argv
  const command: Command = isCommand(first) ? first : CMD.build
  const tail = isCommand(first) ? rest : argv
  const repoAt = tail.indexOf(FLAGS.repo)
  const repoValue = repoAt >= 0 ? tail[repoAt + 1] : undefined
  if (repoAt >= 0 && !repoValue) throw new Error(`${FLAGS.repo} needs a directory`)
  const positional = tail.filter((a, i) => !a.startsWith('-') && (repoAt < 0 || i !== repoAt + 1))
  const unknown = positional.filter((a) => !isTargetSpec(a))
  if (unknown.length > 0) parseTargets(unknown)
  const all = command === CMD.all
  return {
    command,
    targets: all || positional.length === 0 ? [...TARGET_IDS] : parseTargets(positional),
    skipAppBuild: tail.includes(FLAGS.skipAppBuild),
    dockerAutoStart: !tail.includes(FLAGS.noDockerStart),
    keepStage: tail.includes(FLAGS.keepStage),
    deep: all || tail.includes(FLAGS.deep),
    repo: resolve(repoValue ?? DEFAULT_REPO),
    json: tail.includes(FLAGS.json),
  }
}

/** The tool's own dependencies live in `scripts/package/node_modules` (outside the pnpm workspace). */
export async function ensureToolDeps(): Promise<void> {
  if (existsSync(join(TOOL_DIR, NODE_MODULES, TOOL_DEP_MARKER))) return
  console.log('packaging: installing tool dependencies (npm ci in scripts/package)')
  await run(NPM, ['ci', '--no-audit', '--no-fund'], { cwd: TOOL_DIR, onLine: (l) => console.log(`  ${l}`) })
}

async function doctorCommand(args: CliArgs): Promise<number> {
  const report = await doctor({ repoRoot: args.repo })
  console.log(args.json ? JSON.stringify(report, null, JSON_INDENT) : formatDoctor(report))
  return report.ok ? EXIT.ok : EXIT.failed
}

function formatDoctor(r: Awaited<ReturnType<typeof doctor>>): string {
  const rows: [string, unknown][] = [
    ['node', `${r.node}${r.nodeOk ? '' : ' (too old)'}`],
    ['pnpm', r.pnpm],
    ['npm', r.npm],
    ['host arch', r.hostArch],
    ['macOS', r.macos],
    ['rosetta', r.rosetta],
    ['docker cli', r.docker.cli],
    ['docker daemon', r.docker.serverVersion ?? 'not running'],
    ['wine', r.wine ?? 'not installed (not needed)'],
    ['free disk GB', r.freeDiskGb.toFixed(1)],
    ['ok?', r.ok],
  ]
  return rows.map(([k, v]) => `${k.padEnd(DOCTOR_LABEL_WIDTH)}${v}`).join('\n')
}

const buildOptions = (a: CliArgs): BuildOptions => ({
  repoRoot: a.repo,
  targets: a.targets,
  skipAppBuild: a.skipAppBuild,
  dockerAutoStart: a.dockerAutoStart,
  keepStage: a.keepStage,
  deep: a.deep,
})

/** `smoke` judges the targets in the manifest; `all` judges every requested target. */
async function smokeCommand(args: CliArgs): Promise<number> {
  const m = await runSmoke(args.repo)
  const built = TARGET_IDS.filter((id) => m.targets[id] !== undefined)
  return exitCodeFor(m, args.command === CMD.all ? args.targets : built)
}

async function dispatch(args: CliArgs): Promise<number> {
  switch (args.command) {
    case CMD.doctor:
      return doctorCommand(args)
    case CMD.build:
      return exitCodeFor(await buildTargets(buildOptions(args)), args.targets)
    case CMD.audit:
      return exitCodeFor(await auditTargets(args.repo, args.targets, args.deep), args.targets)
    case CMD.smoke:
      return smokeCommand(args)
    case CMD.all: {
      await buildTargets(buildOptions(args))
      return smokeCommand(args)
    }
    default: {
      const never: never = args.command
      throw new Error(`unknown command ${String(never)}`)
    }
  }
}

export async function main(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv)
  if (args.command !== CMD.doctor) await ensureToolDeps()
  return dispatch(args)
}

export async function runMain(argv: readonly string[]): Promise<void> {
  try {
    process.exitCode = await main(argv)
  } catch (error) {
    console.error(`packaging: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = EXIT.failed
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await runMain(process.argv.slice(ARGV_USER_START))
