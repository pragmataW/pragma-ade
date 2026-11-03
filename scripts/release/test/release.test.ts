import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { expectedAssets, parseSums, updateCask } from '../cask.ts'
import { draftNotes, insertSection, sectionBody } from '../changelog.ts'
import { bumpRepo, nextVersion, replaceVersionFields, rewriteReadme } from '../version.ts'

const SHA_A = 'a'.repeat(64)
const SHA_B = 'b'.repeat(64)
const OLD_SHA = 'd'.repeat(64)

describe('nextVersion', () => {
  test('bumps by kind', () => {
    expect(nextVersion('0.9.2', 'patch')).toBe('0.9.3')
    expect(nextVersion('0.9.2', 'minor')).toBe('0.10.0')
    expect(nextVersion('0.9.2', 'major')).toBe('1.0.0')
  })
  test('accepts a greater explicit version and refuses others', () => {
    expect(nextVersion('0.9.2', '0.9.10')).toBe('0.9.10')
    expect(() => nextVersion('0.9.2', '0.9.2')).toThrow(/not greater/)
    expect(() => nextVersion('0.9.2', 'v1')).toThrow(/X.Y.Z/)
  })
})

describe('version fields and README', () => {
  test('replaces the top-level and packages[""] versions of a lockfile only', () => {
    const lock = `{\n  "version": "0.9.2",\n  "packages": {\n    "": {\n      "version": "0.9.2"\n    },\n    "node_modules/x": {\n      "version": "0.9.2"\n    }\n  }\n}\n`
    const out = replaceVersionFields(lock, '0.9.2', '0.9.3', 2)
    expect(out.match(/0\.9\.3/g)).toHaveLength(2)
    expect(out).toContain('"node_modules/x": {\n      "version": "0.9.2"')
  })
  test('rewrites release links, file names and the release link text, nothing else', () => {
    const readme = [
      '[`pragma-ade-0.9.2-mac-arm64.dmg`](https://github.com/o/r/releases/download/v0.9.2/pragma-ade-0.9.2-mac-arm64.dmg)',
      'attached to the [v0.9.2 release](https://github.com/o/r/releases/tag/v0.9.2).',
      'Requires tool 0.9.2 or later.',
    ].join('\n')
    expect(rewriteReadme(readme, '0.9.2', '0.9.3')).toBe(
      [
        '[`pragma-ade-0.9.3-mac-arm64.dmg`](https://github.com/o/r/releases/download/v0.9.3/pragma-ade-0.9.3-mac-arm64.dmg)',
        'attached to the [v0.9.3 release](https://github.com/o/r/releases/tag/v0.9.3).',
        'Requires tool 0.9.2 or later.',
      ].join('\n'),
    )
  })
})

describe('bumpRepo', () => {
  let dir = ''
  afterEach(() => rmSync(dir, { recursive: true, force: true }))
  const put = (rel: string, text: string): void => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    writeFileSync(join(dir, rel), text)
  }
  const pkg = (version: string): string => `{\n  "name": "x",\n  "version": "${version}"\n}\n`

  test('bumps tracked packages on the current version, the lockfile and README; skips fixtures', () => {
    dir = mkdtempSync(join(tmpdir(), 'release-bump-'))
    put('package.json', pkg('0.9.2'))
    put('modules/a/package.json', pkg('0.9.2'))
    put('modules/b/package.json', pkg('1.0.0'))
    put('test/fixtures/c/package.json', pkg('0.9.2'))
    put(
      'scripts/package/package-lock.json',
      `{\n  "version": "0.9.2",\n  "packages": { "": { "version": "0.9.2" } }\n}\n`,
    )
    put('README.md', 'see releases/tag/v0.9.2\n')
    execFileSync('git', ['init', '-q'], { cwd: dir })
    execFileSync('git', ['add', '.'], { cwd: dir })

    const changed = bumpRepo(dir, '0.9.2', '0.9.3')

    expect(changed.sort()).toEqual(
      ['README.md', 'modules/a/package.json', 'package.json', 'scripts/package/package-lock.json'].sort(),
    )
    expect(readFileSync(join(dir, 'modules/b/package.json'), 'utf8')).toBe(pkg('1.0.0'))
    expect(readFileSync(join(dir, 'test/fixtures/c/package.json'), 'utf8')).toBe(pkg('0.9.2'))
    expect(readFileSync(join(dir, 'scripts/package/package-lock.json'), 'utf8')).not.toContain('0.9.2')
  })
})

describe('changelog', () => {
  const changelog = [
    '# Changelog',
    '',
    'Intro.',
    '',
    '## [0.9.2] - 2026-11-02',
    '',
    '### Fixed',
    '',
    '- Old fix.',
    '',
    '[0.9.2]: https://github.com/pragmataW/pragma-ade/releases/tag/v0.9.2',
    '',
  ].join('\n')

  test('reads a section body without heading or link references', () => {
    expect(sectionBody(changelog, '0.9.2')).toBe('### Fixed\n\n- Old fix.')
    expect(sectionBody(changelog, '0.9.3')).toBeUndefined()
  })
  test('inserts a new section and its link reference above the newest ones', () => {
    const out = insertSection(changelog, '0.9.3', '2026-11-03', '## [0.9.3]\n<!-- draft -->\n### Added\n\n- New.\n')
    expect(out).toContain('Intro.\n\n## [0.9.3] - 2026-11-03\n\n### Added\n\n- New.\n\n## [0.9.2] - 2026-11-02')
    expect(out).toContain(
      '[0.9.3]: https://github.com/pragmataW/pragma-ade/releases/tag/v0.9.3\n[0.9.2]: https://github.com/pragmataW/pragma-ade/releases/tag/v0.9.2',
    )
    expect(sectionBody(out, '0.9.3')).toBe('### Added\n\n- New.')
  })
  test('turns [Unreleased] into the release when no notes are given', () => {
    const withUnreleased = changelog.replace('## [0.9.2]', '## [Unreleased]\n\n### Fixed\n\n- Pending.\n\n## [0.9.2]')
    const out = insertSection(withUnreleased, '0.9.3', '2026-11-03', '')
    expect(sectionBody(out, '0.9.3')).toBe('### Fixed\n\n- Pending.')
    expect(() => insertSection(out, '0.9.3', '2026-11-03', 'x')).toThrow(/already/)
  })
  test('drafts Added/Changed/Fixed from conventional commit subjects', () => {
    const draft = draftNotes([
      'fix(chat): keep the toolbar',
      'feat(chat): tasks panel',
      'refactor: tidy',
      'test(chat): selectors',
      'chore(release): version 0.9.2',
    ])
    expect(draft).toContain(
      '### Added\n\n- **chat:** Tasks panel\n\n### Changed\n\n- Tidy\n\n### Fixed\n\n- **chat:** Keep',
    )
    expect(draft).not.toContain('selectors')
    expect(draftNotes(['Merge branch x'])).toContain('TODO')
  })
})

describe('assets and cask', () => {
  const cask = [
    'cask "pragma-ade" do',
    '  arch arm: "arm64", intel: "x64"',
    '',
    '  version "0.9.2"',
    `  sha256 arm:   "${OLD_SHA}",`,
    `         intel: "${OLD_SHA}"`,
    '',
    '  url "https://github.com/pragmataW/pragma-ade/releases/download/v#{version}/pragma-ade-#{version}-mac-#{arch}.zip"',
    'end',
  ].join('\n')
  const sums = [
    `${SHA_A}  pragma-ade-0.9.3-mac-arm64.zip`,
    `${SHA_B}  pragma-ade-0.9.3-mac-x64.zip`,
    `${OLD_SHA}  pragma-ade-0.9.3-mac-arm64.dmg`,
  ].join('\n')

  test('lists the eight release assets under dist/<target>', () => {
    const assets = expectedAssets('0.9.3')
    expect(assets).toHaveLength(8)
    expect(assets).toContain('dist/linux-x64/pragma-ade-0.9.3-linux-x86_64.AppImage')
    expect(assets).toContain('dist/win32-x64/pragma-ade-0.9.3-win-x64-setup.exe')
  })
  test('parses SHA256SUMS', () => {
    expect(parseSums(sums).get('pragma-ade-0.9.3-mac-x64.zip')).toBe(SHA_B)
  })
  test('updates version and per-arch zip sha256, keeping the arch line and url', () => {
    const out = updateCask(cask, '0.9.3', sums)
    expect(out).toContain('  version "0.9.3"')
    expect(out).toContain(`sha256 arm:   "${SHA_A}",\n         intel: "${SHA_B}"`)
    expect(out).toContain('arch arm: "arm64", intel: "x64"')
    expect(out).toContain('#{version}/pragma-ade-#{version}-mac-#{arch}.zip')
  })
  test('fails when a mac zip checksum is missing', () => {
    expect(() => updateCask(cask, '0.9.4', sums)).toThrow(/no pragma-ade-0.9.4-mac-arm64.zip/)
  })
})
