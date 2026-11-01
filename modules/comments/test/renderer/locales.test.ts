import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { COMMENT_SOURCES, SEND_ERROR_KEYS, sendErrorI18nKey } from '../../src/contract'

const MODULE = join(import.meta.dirname, '..', '..')
const en = JSON.parse(readFileSync(join(MODULE, 'locales', 'en.json'), 'utf8'))
const NAMESPACE = 'comments:'
const PLURAL_SUFFIXES = ['', '_one', '_other']

/** True when the fully-qualified key (or its plural forms) has a string in en.json. */
const exists = (key: string): boolean =>
  PLURAL_SUFFIXES.some((suffix) => {
    const value = `${key.slice(NAMESPACE.length)}${suffix}`
      .split('.')
      .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], en)
    return typeof value === 'string'
  })

const rendererFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? rendererFiles(join(dir, e.name)) : [join(dir, e.name)],
  )
const KEY_RE = /['"`](comments:[A-Za-z0-9_.]+)['"`]/g
const usedKeys = rendererFiles(join(MODULE, 'src', 'renderer')).flatMap((f) =>
  [...readFileSync(f, 'utf8').matchAll(KEY_RE)].map((m) => m[1] as string),
)

it.each([...new Set(usedKeys), `${NAMESPACE}module.name`])('%s exists in en.json', (key) =>
  expect(exists(key)).toBe(true),
)
it.each(SEND_ERROR_KEYS)('errors.%s has a string', (k) => expect(exists(sendErrorI18nKey(k))).toBe(true))
it.each(COMMENT_SOURCES)('row.source.%s has a string', (s) => expect(exists(`${NAMESPACE}row.source.${s}`)).toBe(true))
