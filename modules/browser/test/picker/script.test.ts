import { expect, it } from 'vitest'
import { reactProbeScript } from '../../src/main/picker/react-probe'
import { buildPickerScript, PICKER_ACTIONS } from '../../src/main/picker/script'
import { SCRIPT_OPTS } from '../lib/builders'

it.each(PICKER_ACTIONS)('%s script is self-contained', (a) => {
  const s = buildPickerScript(a, SCRIPT_OPTS)
  expect(s).not.toMatch(/__name\(|require\(|import\(|__vite_ssr/)
  expect(() => new Function(`return (${s})`)).not.toThrow()
})

it('the probe script is self-contained', () => {
  const s = reactProbeScript('n1')
  expect(s).not.toMatch(/__name\(|require\(|import\(|__vite_ssr/)
  expect(s).toContain('"nonce":"n1"')
})
