import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GLIBC_BASELINE_MINOR } from '../constants.ts'
import { detectBinaryFile } from '../lib/binary-arch.ts'
import { dockerCompileNative, ensureDocker } from '../lib/docker.ts'
import { run } from '../lib/exec.ts'
import { mkTemp } from '../lib/fsx.ts'

const docker = await ensureDocker({ autoStart: true })

describe.skipIf(!docker.ok)('docker (skipped: docker unavailable)', () => {
  it('compiles node-pty for linux-x64', async () => {
    const root = mkTemp('docker root')
    await run('npm', ['init', '-y'], { cwd: root })
    await run(
      'npm',
      ['install', 'node-pty@1.1.0', '--ignore-scripts', '--os=linux', '--cpu=x64', '--no-audit', '--no-fund'],
      {
        cwd: root,
      },
    )
    const { files, glibcMax } = await dockerCompileNative(root, 'node_modules/node-pty', '45.2.1')
    expect(files).toContain('build/Release/pty.node')
    const info = await detectBinaryFile(join(root, 'node_modules/node-pty/build/Release/pty.node'))
    expect(info).toMatchObject({ format: 'elf', arches: ['x64'] })
    expect(Number(glibcMax.split('.')[1])).toBeLessThanOrEqual(GLIBC_BASELINE_MINOR)
  })
})
