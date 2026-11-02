import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { ARGV_SKIP, UTF8 } from './constants'
import { type CliIo, defaultDeps, run } from './main'

/** Injected by esbuild (`build.mjs`). */
declare const PRAGMA_CLI_VERSION: string

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString(UTF8)
}

const io: CliIo = {
  env: process.env,
  cwd: process.cwd(),
  platform: process.platform,
  home: homedir(),
  stdout: (s) => process.stdout.write(s),
  stderr: (s) => process.stderr.write(s),
  readFile: (p) => readFile(p, UTF8),
  readStdin,
}

run(process.argv.slice(ARGV_SKIP), io, defaultDeps(PRAGMA_CLI_VERSION)).then((code) => {
  process.exitCode = code
})
