import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach } from 'vitest'
import type { CliInstallDeps } from '../../src/main/install-cli'
import type { CliPaths } from '../../src/main/paths'
import { renderCmdShim, renderPosixShim } from '../../src/main/shim'

const roots: string[] = []
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true })
})

/** A temp HOME with a generated shim in `<root>/ud/bin`; win32 is simulated with a fake user PATH. */
export function makeInstallDeps(
  o: { platform?: NodeJS.Platform; shellPath?: string | undefined; userPath?: string } = {},
) {
  const root = mkdtempSync(join(tmpdir(), 'pragma-install-'))
  roots.push(root)
  const platform = o.platform ?? 'darwin'
  const home = join(root, 'home')
  const binDir = join(root, 'ud', 'bin')
  mkdirSync(home, { recursive: true })
  mkdirSync(binDir, { recursive: true })
  const win = platform === 'win32'
  const paths: CliPaths = {
    bundlePath: join(root, 'pragma.cjs'),
    skillsDir: join(root, 'skills'),
    binDir,
    shimPath: join(binDir, win ? 'pragma.cmd' : 'pragma'),
    bridgeFile: join(root, 'ud', 'bridge.json'),
    execPath: '/app/Electron',
  }
  writeFileSync(paths.shimPath, win ? renderCmdShim(paths) : renderPosixShim(paths))
  const user = { value: o.userPath ?? 'C:\\Windows' }
  const deps: CliInstallDeps = {
    platform,
    home,
    paths,
    shellPath: async () => ('shellPath' in o ? o.shellPath : '/usr/bin'),
    userPath: {
      get: async () => user.value,
      set: async (v) => {
        user.value = v
      },
    },
  }
  return { deps, root, home, paths, user }
}
