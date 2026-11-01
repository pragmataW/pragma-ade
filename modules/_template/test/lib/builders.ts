import { join } from 'node:path'
import { createTestModuleHost, loadModuleRecord, type TestModuleHost } from '@pragma/test-support'

export const MODULE_DIR = join(import.meta.dirname, '..', '..')

/** The real main host in-process with only this module, a temp userData and a fake platform. */
export async function startExample(settings?: Record<string, unknown>): Promise<TestModuleHost> {
  return createTestModuleHost({ modules: [await loadModuleRecord(MODULE_DIR)], settings })
}
