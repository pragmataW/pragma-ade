import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { collectPackaging, listWorkspacePackages, ManifestError } from '../lib/workspace.ts'
import { makeRepo, pkg, resources } from './support/repo.ts'

const TERMINAL = 'modules/terminal/package.json'
const DAEMON = 'modules/terminal/packages/pty-daemon/package.json'
const terminalOwner = pkg('@pragma/module-terminal', { id: 'terminal' })
const daemon = (pragma: object) => pkg('@pragma/terminal-pty-daemon', { build: 'build', ...pragma })
const plan = (files: Record<string, object>) => collectPackaging(listWorkspacePackages(makeRepo(files)))

describe('listWorkspacePackages', () => {
  it('roles and owner ids', () => {
    const root = makeRepo({
      'apps/desktop/package.json': pkg('@pragma/desktop'),
      [TERMINAL]: terminalOwner,
      [DAEMON]: daemon({}),
      'modules/terminal/fixtures/x/package.json': pkg('stray'),
    })
    const byName = Object.fromEntries(listWorkspacePackages(root).map((p) => [p.name, [p.role, p.ownerId]]))
    expect(byName).toEqual({
      '@pragma/desktop': ['app', null],
      '@pragma/module-terminal': ['owner', 'terminal'],
      '@pragma/terminal-pty-daemon': ['sub-package', 'terminal'],
    })
  })
  it('warns about unsupported patterns', () => {
    const warnings: string[] = []
    listWorkspacePackages(makeRepo({ 'pnpm-workspace.yaml': 'packages:\n  - "x/**"\n  - "!y"\n' }), warnings)
    expect(warnings).toHaveLength(2)
  })
})

describe('collectPackaging', () => {
  it('excludes _template', () => {
    const p = plan({
      'modules/_template/package.json': pkg('t', { id: '_template', ...resources({ from: 'a', to: 'a' }) }),
    })
    expect(p.resources).toEqual([])
  })
  it('sub-package declaration lands under its owner', () => {
    const p = plan({ [TERMINAL]: terminalOwner, [DAEMON]: daemon(resources({ from: 'dist', to: 'pty-daemon' })) })
    expect(p.resources.map((r) => r.dest)).toEqual(['modules/terminal/pty-daemon'])
  })
  it('provider declaration', () => {
    const p = plan({
      'providers/claude/package.json': pkg('@pragma/provider-claude', { id: 'claude' }),
      'providers/claude/packages/hooks/package.json': pkg('h', {
        build: 'build',
        ...resources({ from: 'dist', to: 'hooks' }),
      }),
    })
    expect(p.resources.map((r) => r.dest)).toEqual(['modules/claude/hooks'])
    expect(p.unpackagedBuilds).toEqual([])
  })
  it('declaration appears once a module declares it', () => {
    const before = plan({ [TERMINAL]: terminalOwner, [DAEMON]: daemon({}) })
    expect(before.resources).toEqual([])
    expect(before.unpackagedBuilds).toEqual([{ ownerId: 'terminal', packageName: '@pragma/terminal-pty-daemon' }])
    const after = plan({ [TERMINAL]: terminalOwner, [DAEMON]: daemon(resources({ from: 'dist', to: 'pty-daemon' })) })
    expect(after.resources).toHaveLength(1)
    expect(after.unpackagedBuilds).toEqual([])
  })
  it('sub-package from resolves against the sub-package dir', () => {
    const root = makeRepo({
      [TERMINAL]: terminalOwner,
      [DAEMON]: daemon(resources({ from: 'dist', to: 'pty-daemon' })),
    })
    const [r] = collectPackaging(listWorkspacePackages(root)).resources
    expect(r?.fromAbs).toBe(join(root, 'modules/terminal/packages/pty-daemon/dist'))
  })
  it.each([
    ['to ..', [{ from: 'dist', to: '../x' }]],
    ['to absolute', [{ from: 'dist', to: '/abs' }]],
    ['to backslash', [{ from: 'dist', to: 'a\\b' }]],
    ['from outside', [{ from: '../x', to: 'x' }]],
    ['from node_modules', [{ from: 'node_modules/node-pty', to: 'np' }]],
    [
      'duplicate dest',
      [
        { from: 'a', to: 'x' },
        { from: 'b', to: 'x' },
      ],
    ],
    [
      'nested dest',
      [
        { from: 'a', to: 'x' },
        { from: 'b', to: 'x/y' },
      ],
    ],
  ])('rejects %s', (_name, entries) => {
    expect(() => plan({ [TERMINAL]: terminalOwner, [DAEMON]: daemon(resources(...entries)) })).toThrow(ManifestError)
    expect(() => plan({ [TERMINAL]: terminalOwner, [DAEMON]: daemon(resources(...entries)) })).toThrow(
      /@pragma\/terminal-pty-daemon/,
    )
  })
})
