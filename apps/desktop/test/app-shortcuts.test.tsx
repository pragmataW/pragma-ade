import { createShortcutRegistry } from '@pragma/sdk/runtime/renderer'
import { memoryLogger } from '@pragma/test-support'
import { fireEvent, render } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useAppShortcuts } from '../src/renderer/lib/use-app-shortcuts'

function Harness({ host }: { host: Parameters<typeof useAppShortcuts>[0] }) {
  useAppShortcuts(host)
  return null
}

const setup = (platform: string) => {
  const log = memoryLogger()
  const shortcuts = createShortcutRegistry(platform, log)
  shortcuts.register({
    id: 'core.commandPalette',
    accelerator: 'CmdOrCtrl+K',
    scope: 'app',
    command: 'core.commandPalette',
  })
  const execute = vi.fn(async () => undefined)
  render(
    <Harness
      host={{ shortcuts: { ...shortcuts, onChange: shortcuts.onChange }, commands: { execute } as never, log } as never}
    />,
  )
  return execute
}

it.each([
  ['darwin', { metaKey: true }],
  ['linux', { ctrlKey: true }],
])('Mod+K runs the palette command on %s', (platform, mods) => {
  const execute = setup(platform)
  fireEvent.keyDown(window, { key: 'k', code: 'KeyK', ...mods })
  expect(execute).toHaveBeenCalledWith('core.commandPalette', undefined)
})
it('unregistered chords pass through', () => {
  const execute = setup('darwin')
  const event = new KeyboardEvent('keydown', { key: 'j', code: 'KeyJ', metaKey: true, cancelable: true })
  window.dispatchEvent(event)
  expect(execute).not.toHaveBeenCalled()
  expect(event.defaultPrevented).toBe(false)
})
