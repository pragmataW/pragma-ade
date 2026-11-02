import type { EditorViewLike } from '../../src/main/views/viewManager'

export interface FakeView extends EditorViewLike {
  loads: string[]
  closed: boolean
}

let nextId = 1

export function fakeView(): FakeView {
  const view: FakeView = {
    loads: [],
    closed: false,
    webContents: {
      id: nextId++,
      loadURL: async (url) => void view.loads.push(url),
      close: () => {
        view.closed = true
      },
    },
  }
  return view
}

/** Records every `ctx.nativeViews` call as `<op>:<viewId>`. */
export function fakeNativeViews() {
  const calls: string[] = []
  const attached = new Map<string, unknown>()
  return {
    calls,
    attached,
    api: {
      attach: (id: string, view: unknown, opts: { panelTabId: string }) => {
        calls.push(`attach:${id}:${opts.panelTabId}`)
        attached.set(id, view)
        return { dispose: () => undefined }
      },
      detach: (id: string) => {
        calls.push(`detach:${id}`)
        attached.delete(id)
      },
      show: (id: string) => void calls.push(`show:${id}`),
      hide: (id: string) => void calls.push(`hide:${id}`),
    },
  }
}
