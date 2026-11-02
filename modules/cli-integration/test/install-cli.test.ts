import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cliInstallStatus, defaultInstallDir, installCli, uninstallCli } from '../src/main/install-cli'
import { assertSafeHome } from '../src/main/safe-home'
import { makeInstallDeps } from './support/install'

const POSIX = process.platform !== 'win32'

describe.skipIf(!POSIX)('installCli (posix)', () => {
  it('installs a symlink in <home>/.local/bin pointing to the shim', async () => {
    const t = makeInstallDeps()
    const dir = defaultInstallDir('darwin', t.home, t.paths.binDir)
    expect(dir).toBe(join(t.home, '.local', 'bin'))
    const status = await installCli(dir, t.deps)
    expect(lstatSync(join(dir, 'pragma')).isSymbolicLink()).toBe(true)
    expect(readlinkSync(join(dir, 'pragma'))).toBe(t.paths.shimPath)
    expect(status).toMatchObject({ state: 'installed', linkPath: join(dir, 'pragma'), shimPath: t.paths.shimPath })
  })

  it('status: installed after install, not_installed after uninstall', async () => {
    const t = makeInstallDeps()
    const dir = join(t.home, 'bin')
    expect((await cliInstallStatus(dir, t.deps)).state).toBe('not_installed')
    await installCli(dir, t.deps)
    expect((await cliInstallStatus(dir, t.deps)).state).toBe('installed')
    expect((await uninstallCli(dir, t.deps)).state).toBe('not_installed')
    expect(existsSync(join(dir, 'pragma'))).toBe(false)
  })

  it.each([
    ['an existing regular file', (link: string) => writeFileSync(link, 'mine')],
    ['a foreign symlink', (link: string) => symlinkSync('/usr/bin/true', link)],
  ])('%s → conflict, never overwritten', async (_name, create) => {
    const t = makeInstallDeps()
    const dir = join(t.home, 'bin')
    mkdirSync(dir)
    const link = join(dir, 'pragma')
    create(link)
    const before = lstatSync(link).isSymbolicLink() ? readlinkSync(link) : readFileSync(link, 'utf8')
    expect((await cliInstallStatus(dir, t.deps)).state).toBe('conflict')
    await expect(installCli(dir, t.deps)).rejects.toMatchObject({ code: 'conflict' })
    await uninstallCli(dir, t.deps)
    expect(lstatSync(link).isSymbolicLink() ? readlinkSync(link) : readFileSync(link, 'utf8')).toBe(before)
  })

  it('install twice is a no-op', async () => {
    const t = makeInstallDeps()
    const dir = join(t.home, 'bin')
    await installCli(dir, t.deps)
    expect((await installCli(dir, t.deps)).state).toBe('installed')
  })

  it.each([
    ['on PATH', (dir: string) => `/usr/bin:${dir}`, true],
    ['not on PATH', () => '/usr/bin', false],
    ['unknown PATH', () => undefined, null],
  ])('dirOnPath: %s', async (_name, shellPath, expected) => {
    const probe = makeInstallDeps()
    const dir = join(probe.home, 'bin')
    const t = { ...probe.deps, shellPath: async () => shellPath(dir) }
    expect((await cliInstallStatus(dir, t)).dirOnPath).toBe(expected)
  })

  it('bundleFound reflects the bundle file', async () => {
    const t = makeInstallDeps()
    expect((await cliInstallStatus(t.home, t.deps)).bundleFound).toBe(false)
    writeFileSync(t.paths.bundlePath, '')
    expect((await cliInstallStatus(t.home, t.deps)).bundleFound).toBe(true)
  })
})

describe('installCli (win32, simulated)', () => {
  it('the default dir is the shim dir; install adds it to the user PATH once, case-insensitively', async () => {
    const t = makeInstallDeps({ platform: 'win32', userPath: 'C:\\Windows' })
    const dir = defaultInstallDir('win32', t.home, t.paths.binDir)
    expect(dir).toBe(t.paths.binDir)
    await installCli(dir, t.deps)
    t.user.value = t.user.value.toUpperCase()
    await installCli(dir, t.deps)
    expect(t.user.value.split(';')).toHaveLength(2)
    expect((await cliInstallStatus(dir, t.deps)).state).toBe('installed')
  })

  it('uninstall removes only our entry', async () => {
    const t = makeInstallDeps({ platform: 'win32', userPath: 'C:\\Windows;D:\\tools' })
    await installCli(t.paths.binDir, t.deps)
    await uninstallCli(t.paths.binDir, t.deps)
    expect(t.user.value).toBe('C:\\Windows;D:\\tools')
  })

  it('copies pragma.cmd to a custom dir', async () => {
    const t = makeInstallDeps({ platform: 'win32' })
    const dir = join(t.home, 'tools')
    const status = await installCli(dir, t.deps)
    expect(readFileSync(join(dir, 'pragma.cmd'), 'utf8')).toBe(readFileSync(t.paths.shimPath, 'utf8'))
    expect(status).toMatchObject({ state: 'installed', linkPath: join(dir, 'pragma.cmd') })
  })

  it('a foreign pragma.cmd in a custom dir is a conflict', async () => {
    const t = makeInstallDeps({ platform: 'win32' })
    const dir = join(t.home, 'tools')
    mkdirSync(dir)
    writeFileSync(join(dir, 'pragma.cmd'), 'echo mine')
    await expect(installCli(dir, t.deps)).rejects.toMatchObject({ code: 'conflict' })
  })
})

describe('assertSafeHome', () => {
  it.each([
    ['test mode + real home throws', '/Users/me', true, true],
    ['test mode + temp home passes', '/tmp/h', true, false],
    ['outside test mode passes', '/Users/me', false, false],
  ])('%s', (_name, home, isTest, throws) => {
    const call = () => assertSafeHome(home, { isTest, realHome: '/Users/me/' })
    if (throws) expect(call).toThrow(/real home/)
    else expect(call).not.toThrow()
  })
})
