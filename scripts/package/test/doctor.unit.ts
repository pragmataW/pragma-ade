import { describe, expect, it } from 'vitest'
import { parseArgs } from '../cli.ts'
import { doctor, versionAtLeast } from '../lib/doctor.ts'
import { ExecError, run } from '../lib/exec.ts'

const REPO = '/'

describe('doctor', () => {
  it('doctor reports required fields', async () => {
    const r = await doctor({ repoRoot: REPO })
    expect(r.hostArch).toBe(process.arch)
    expect(typeof r.docker.daemon).toBe('boolean')
    expect(r.freeDiskGb).toBeGreaterThan(0)
    expect(r.nodeOk).toBe(versionAtLeast(process.version, '22.18.0'))
  })
  it.each([
    ['v25.8.0', '22.18.0', true],
    ['22.18.0', '22.18.0', true],
    ['v22.9.1', '22.18.0', false],
  ])('versionAtLeast(%s, %s) = %s', (a, b, ok) => expect(versionAtLeast(a, b)).toBe(ok))
})

describe('run', () => {
  it('rejects a non-zero exit with its code', async () => {
    const error = await run('sh', ['-c', 'exit 3']).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ExecError)
    expect((error as ExecError).code).toBe(3)
  })
  it('resolves a non-zero exit with allowFail', async () => {
    await expect(run('sh', ['-c', 'exit 3'], { allowFail: true })).resolves.toMatchObject({ code: 3 })
  })
  it('streams lines', async () => {
    const lines: string[] = []
    await run('sh', ['-c', 'echo a; echo b'], { onLine: (l) => lines.push(l) })
    expect(lines).toEqual(['a', 'b'])
  })
})

describe('parseArgs', () => {
  it('build mac --skip-app-build', () => {
    expect(parseArgs(['build', 'mac', '--skip-app-build'])).toMatchObject({
      command: 'build',
      targets: ['darwin-arm64', 'darwin-x64'],
      skipAppBuild: true,
      dockerAutoStart: true,
    })
  })
  it('a bare target spec means build (root package:* scripts)', () => {
    expect(parseArgs(['linux'])).toMatchObject({ command: 'build', targets: ['linux-x64'] })
  })
  it('--repo takes the next argument', () => {
    expect(parseArgs(['doctor', '--repo', '/tmp/a b'])).toMatchObject({ command: 'doctor', repo: '/tmp/a b' })
  })
  it('rejects unknown targets', () => expect(() => parseArgs(['build', 'solaris'])).toThrow(/Unknown target/))
})
