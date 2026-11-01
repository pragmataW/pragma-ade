import { expect, test } from 'vitest'
import { resolveDaemonEntry } from '../src/main/daemon-entry'

const resource = (id: string, rel: string) => `/res/${id}/${rel}`

test.each([
  [true, 'returns the path'],
  [false, 'throws the build hint'],
])('exists=%s %s', (exists, _what) => {
  const run = () => resolveDaemonEntry(resource, () => exists)
  if (exists) expect(run()).toBe('/res/terminal/packages/pty-daemon/dist/pty-daemon.cjs')
  else expect(run).toThrow(/pty-daemon bundle missing at .*pragma\.build/)
})
