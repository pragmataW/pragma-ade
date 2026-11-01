import type { Page } from '@playwright/test'
import { CoreIpc, type DialogStubs, type IpcContract, IpcError, type IpcResponse } from '@pragma/sdk'

type BridgeWindow = { pragma: { invoke(channel: string, input: unknown): Promise<IpcResponse> } }

/** Calls `window.pragma.invoke` inside the page and throws `IpcError` on `ok:false`. */
export async function invoke<T = unknown>(window: Page, channel: string, input?: unknown): Promise<T> {
  const reply = await window.evaluate(([c, i]) => (globalThis as unknown as BridgeWindow).pragma.invoke(c, i), [
    channel,
    input,
  ] as const)
  if (!reply.ok) throw new IpcError(reply.error.code, reply.error.message)
  return reply.value as T
}

/** Typed variant over an IPC contract. */
export function invokeIpc<I, O>(window: Page, contract: IpcContract<I, O>, input?: I): Promise<O> {
  return invoke<O>(window, contract.channel, input)
}

/** Replaces the main-process dialog stubs at runtime (`core.test.dialogStubs.set`, test mode only). */
export async function stubDialogs(window: Page, stubs: DialogStubs): Promise<void> {
  await invoke(window, CoreIpc.testDialogStubsSet.channel, stubs)
}
