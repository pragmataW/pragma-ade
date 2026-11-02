import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { appLayout, extractArchive } from '../lib/archive.ts'
import { doctor } from '../lib/doctor.ts'
import { probeHost, probeLinuxInDocker } from '../lib/probe.ts'
import { TARGETS, type TargetId } from '../lib/targets.ts'
import { PROOF_NAMES, PROOF_NATIVES, proofArtifact } from './support/proof.ts'

const host = await doctor({ repoRoot: '/' })

async function probeArtifact(id: TargetId, artifact: string) {
  const target = TARGETS[id]
  const extracted = await extractArchive(artifact)
  if (target.platform !== 'linux') return probeHost(appLayout(extracted, target, PROOF_NAMES), target)
  const root = join(extracted, 'opt', PROOF_NAMES.productName)
  return probeLinuxInDocker(root, appLayout(root, target, PROOF_NAMES), target)
}

describe('native runtime probe (needs the toolchain proof outputs)', () => {
  it.for<[TargetId, string]>([
    ['darwin-arm64', '.zip'],
    ['darwin-x64', '.zip'],
    ['linux-x64', '.deb'],
  ])('%s %s', async ([id, ext], ctx) => {
    const artifact = proofArtifact(id, ext)
    if (!artifact) return ctx.skip(`no ${id} proof artifact (run toolchain.int.ts first)`)
    if (id === 'darwin-x64' && !host.rosetta) return ctx.skip('no Rosetta')
    const result = await probeArtifact(id, artifact)
    if (result.skipped) return ctx.skip(`probe skipped: ${result.skipped}`)
    expect(result.results.filter((r) => !r.ok)).toEqual([])
    expect(result.ok).toBe(true)
    const names = result.results.map((r) => r.name)
    for (const n of PROOF_NATIVES) expect(names).toContain(n)
  })
})
