import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { auditTarget } from '../lib/audit.ts'
import { TARGET_IDS, TARGETS, type TargetId } from '../lib/targets.ts'
import { MINI_REPO_DIR } from './support/fixture-paths.ts'
import { PROOF_NAMES, proofArtifact, proofOutputDir } from './support/proof.ts'

const FILE_CMD: Partial<Record<TargetId, RegExp>> = {
  'linux-x64': /ELF 64-bit LSB.*x86-64/,
  'win32-x64': /PE32\+ executable.*x86-64/,
}

describe('audit of the toolchain proof outputs', () => {
  it.for(TARGET_IDS)('%s', async (id, ctx) => {
    if (!proofArtifact(id, '.zip') && !proofArtifact(id, '.deb')) return ctx.skip(`no ${id} proof artifacts`)
    const main = JSON.parse(readFileSync(join(MINI_REPO_DIR, 'apps/desktop/package.json'), 'utf8')).main
    const exp = {
      ...PROOF_NAMES,
      main,
      resourceDests: ['modules/terminal/pty-daemon'],
      nativePackages: ['better-sqlite3', 'node-pty', '@parcel/watcher'],
    }
    const r = await auditTarget(TARGETS[id], proofOutputDir(id), exp, { deep: false })
    expect(r.checks.filter((c) => !c.ok)).toEqual([])
    expect(r.ok).toBe(true)
    const fileRe = FILE_CMD[id]
    if (fileRe) for (const f of r.nativeFiles) expect(f.fileCmd, f.path).toMatch(fileRe)
  })
})
