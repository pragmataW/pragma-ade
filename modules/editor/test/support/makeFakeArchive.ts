import { randomBytes } from 'node:crypto'
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { c as tarCreate } from 'tar'

export const FAKE_SERVER_SOURCE = join(import.meta.dirname, '..', 'fixtures', 'fake-reh-server.mjs')
export const FAKE_BIN = 'bin/codium-server'
/** `node` (or an absolute node, so a login-shell PATH without node does not matter). */
const binScript = (node: string): string => `#!/bin/sh\nexec "${node}" "$(dirname "$0")/../server.mjs" "$@"\n`

/** A `.tar.gz` like reh-web: `bin/codium-server` (0755) + `server.mjs` (+ optional root folder and padding). */
export async function makeFakeArchive(
  out: string,
  o: { rootFolder?: string; withBin?: boolean; paddingBytes?: number; nodePath?: string } = {},
): Promise<Buffer> {
  const stage = mkdtempSync(join(tmpdir(), 'pragma-fake-reh-'))
  const root = o.rootFolder ? join(stage, o.rootFolder) : stage
  mkdirSync(join(root, 'bin'), { recursive: true })
  copyFileSync(FAKE_SERVER_SOURCE, join(root, 'server.mjs'))
  if (o.withBin !== false) {
    writeFileSync(join(root, FAKE_BIN), binScript(o.nodePath ?? 'node'))
    chmodSync(join(root, FAKE_BIN), 0o755)
  }
  if (o.paddingBytes) writeFileSync(join(root, 'padding.bin'), randomBytes(o.paddingBytes))
  const entries = o.rootFolder ? [o.rootFolder] : ['bin', 'server.mjs', ...(o.paddingBytes ? ['padding.bin'] : [])]
  await tarCreate({ gzip: true, file: out, cwd: stage, portable: true }, entries)
  rmSync(stage, { recursive: true, force: true })
  return readFileSync(out)
}
