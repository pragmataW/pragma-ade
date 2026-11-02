import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..')
const VSIX = join(ROOT, 'dist', 'pragma-bridge.vsix')

describe('build:vsix', () => {
  it('produces dist/pragma-bridge.vsix and manifest.json whose sha matches', () => {
    const r = spawnSync(process.execPath, ['build.mjs'], { cwd: ROOT, encoding: 'utf8' })
    expect(r.status, r.stderr).toBe(0)
    const manifest = JSON.parse(readFileSync(join(ROOT, 'dist', 'manifest.json'), 'utf8'))
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
    expect(manifest).toEqual({
      version: pkg.version,
      sha256: createHash('sha256').update(readFileSync(VSIX)).digest('hex'),
    })
    const list = spawnSync('unzip', ['-l', VSIX], { encoding: 'utf8' }).stdout
    expect(list).toContain('extension/package.json')
    expect(list).toContain('extension/out/extension.js')
  }, 60_000)
})
