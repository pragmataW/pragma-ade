import { screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { AGENTS_TESTIDS, type ProfileCheck } from '../../src/contract'
import { ProfileWarning } from '../../src/renderer/lib/ProfileWarning'
import { renderWithI18n } from '../support/render'

const found = { status: 'found', path: '/bin/x' } as const

it.each<[string, ProfileCheck, string, string]>([
  [
    'notFound',
    { resolution: { status: 'notFound' }, compatibility: null },
    AGENTS_TESTIDS.commandWarning,
    'dgc was not found on PATH',
  ],
  [
    'notExecutable',
    { resolution: { status: 'notExecutable', path: '/x/dgc' }, compatibility: null },
    AGENTS_TESTIDS.commandWarning,
    '/x/dgc is not executable',
  ],
  [
    'compat',
    {
      resolution: found,
      compatibility: {
        ok: false,
        reasonKey: 'opencode:launch.minVersion',
        params: { required: '2.x', found: '1.1.36' },
      },
    },
    AGENTS_TESTIDS.compatWarning,
    'OpenCode 2.x required (found 1.1.36)',
  ],
])('%s warning', async (_name, check, testId, text) => {
  await renderWithI18n(<ProfileWarning check={check} command="dgc" />)
  expect(screen.getByTestId(testId)).toHaveTextContent(text)
})

it('no warning when found and compatible', async () => {
  const { container } = await renderWithI18n(
    <ProfileWarning check={{ resolution: found, compatibility: { ok: true, version: '2.2.5' } }} command="x" />,
  )
  expect(container).toBeEmptyDOMElement()
})
