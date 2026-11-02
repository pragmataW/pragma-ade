import { describe, expect, it } from 'vitest'
import { computeLanguageStatus, startLanguageStatusReporter } from '../src/languageStatus'
import { fakeApi } from './fakes/vscode'

const TS = { languageId: 'typescript' }

describe('language status', () => {
  it.each([
    ['no editor → idle', undefined, [], { languageId: null, state: 'idle', errors: 0, warnings: 0 }],
    ['ts file, no diags → ok', TS, [], { languageId: 'typescript', state: 'ok', errors: 0, warnings: 0 }],
    [
      '2 errors 1 warning → problems with counts',
      TS,
      [{ severity: 'error' }, { severity: 'error' }, { severity: 'warning' }, { severity: 'hint' }],
      { languageId: 'typescript', state: 'problems', errors: 2, warnings: 1 },
    ],
  ] as const)('%s', (_label, doc, diags, expected) => {
    expect(computeLanguageStatus(doc, [...diags])).toEqual(expected)
  })

  it('reporter dedupes identical statuses', async () => {
    const api = fakeApi({ folder: '/w' })
    api.current.doc = { languageId: 'typescript', path: '/w/a.ts' }
    const sent: unknown[] = []
    const reporter = startLanguageStatusReporter(
      api,
      { request: async (_n: string, p: unknown) => void sent.push(p) } as never,
      5,
    )
    await new Promise((r) => setTimeout(r, 30))
    api.fireChange()
    await new Promise((r) => setTimeout(r, 30))
    api.diags.set('/w/a.ts', [{ severity: 'error', message: 'x', line: 1 }])
    api.fireChange()
    await new Promise((r) => setTimeout(r, 30))
    reporter.dispose()
    expect(sent).toEqual([
      { languageId: 'typescript', state: 'ok', errors: 0, warnings: 0 },
      { languageId: 'typescript', state: 'problems', errors: 1, warnings: 0 },
    ])
  })
})
