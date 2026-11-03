/** Pure release steps for scripts/release.sh; run from the repo root: `node scripts/release/cli.ts <command>`. */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expectedAssets, updateCask } from './cask.ts'
import { draftNotes, insertSection, sectionBody } from './changelog.ts'
import { ARGC, ARGV_USER_START, CHANGELOG, EXIT_FAILED, NEWLINE, USAGE, UTF8 } from './constants.ts'
import { bumpRepo, currentVersion, nextVersion, parseVersion } from './version.ts'

const root = process.cwd()
const changelogPath = join(root, CHANGELOG)
const print = (s: string): void => {
  process.stdout.write(s.endsWith(NEWLINE) ? s : `${s}${NEWLINE}`)
}
/** Every argument a command needs must be present (see USAGE). */
const required = (args: readonly string[], count: number): string[] => {
  if (args.length < count || args.some((a) => a.length === 0)) throw new Error(`missing arguments\n${USAGE}`)
  return [...args]
}
const checked = (v: string | undefined): string => {
  parseVersion(v ?? '')
  return v ?? ''
}
const changelog = (): string => readFileSync(changelogPath, UTF8)

const commands: Record<string, (args: readonly string[]) => void> = {
  current: () => print(currentVersion(root)),
  next: (a) => print(nextVersion(currentVersion(root), required(a, 1).join(''))),
  bump: ([v]) => {
    const changed = bumpRepo(root, currentVersion(root), checked(v))
    if (changed.length > 0) print(changed.join(NEWLINE))
  },
  'has-section': ([v]) => {
    if (sectionBody(changelog(), checked(v)) === undefined) process.exitCode = EXIT_FAILED
  },
  section: ([v]) => {
    const body = sectionBody(changelog(), checked(v))
    if (body === undefined) throw new Error(`${CHANGELOG} has no section for ${v}`)
    print(body)
  },
  'insert-section': (a) => {
    const [v, date = '', notesFile = ''] = required(a, ARGC.insertSection)
    writeFileSync(changelogPath, insertSection(changelog(), checked(v), date, readFileSync(notesFile, UTF8)))
  },
  draft: () => print(draftNotes(readFileSync(process.stdin.fd, UTF8).split(NEWLINE))),
  assets: ([v]) => print(expectedAssets(checked(v)).join(NEWLINE)),
  cask: (a) => {
    const [file = '', v, sumsFile = ''] = required(a, ARGC.cask)
    writeFileSync(file, updateCask(readFileSync(file, UTF8), checked(v), readFileSync(sumsFile, UTF8)))
  },
}

const [command = '', ...rest] = process.argv.slice(ARGV_USER_START)
const run = commands[command]
if (!run) {
  console.error(USAGE)
  process.exit(EXIT_FAILED)
}
try {
  run(rest)
} catch (e) {
  console.error(`release: ${e instanceof Error ? e.message : String(e)}`)
  process.exit(EXIT_FAILED)
}
