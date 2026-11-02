import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EditorIpc, EDITOR_TEST_IDS as T } from '../../src/contract'
import { LanguageStatusItem } from '../../src/renderer/LanguageStatusItem'
import { renderEditor } from '../support/renderer'

const READY = { state: 'ready', version: 'v', port: 1 }

describe('LanguageStatusItem', () => {
  it.each([
    [
      'problems shows counts',
      READY,
      { languageId: 'typescript', state: 'problems', errors: 1, warnings: 2 },
      'typescript · 1 error, 2 warnings',
    ],
    ['ok shows check', READY, { languageId: 'typescript', state: 'ok', errors: 0, warnings: 0 }, 'typescript · ✓'],
    ['idle renders nothing', READY, { languageId: null, state: 'idle', errors: 0, warnings: 0 }, null],
    ['server starting shows starting text', { state: 'starting', version: 'v' }, null, 'Starting editor'],
  ] as const)('%s', async (_label, server, lang, expected) => {
    await renderEditor(<LanguageStatusItem />, {
      replies: { [EditorIpc.getStatus.channel]: server, [EditorIpc.getLanguageStatus.channel]: lang },
    })
    if (expected) expect(screen.getByTestId(T.lspStatus).textContent).toBe(expected)
    else expect(screen.queryByTestId(T.lspStatus)).toBeNull()
  })

  it('only reads status: it never starts the editor', async () => {
    const r = await renderEditor(<LanguageStatusItem />, {
      replies: { [EditorIpc.getStatus.channel]: { state: 'not-installed', version: 'v', sizeBytes: 1 } },
    })
    expect(new Set(r.calls.map((c) => c.channel))).toEqual(
      new Set([EditorIpc.getStatus.channel, EditorIpc.getLanguageStatus.channel]),
    )
  })
})
