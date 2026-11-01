import { join } from 'node:path'
import { loadModuleRecord } from '@pragma/test-support'
import { DEFAULT_MODULE_ROOTS, EXTENSION_PROOF_ROOTS } from '../../../scripts/lib/constants.ts'
import { REPO_ROOT } from './workspace.ts'

export const FIXTURE_ROOT = join(REPO_ROOT, 'test/architecture/fixtures/extension-proof')
export const PROBE_DIR = join(FIXTURE_ROOT, 'modules/probe')
export const PROBE_PROVIDER_DIR = join(FIXTURE_ROOT, 'providers/probe-provider')
export const DEFAULT_ROOTS = [...DEFAULT_MODULE_ROOTS]
export const PROOF_ROOTS = [...DEFAULT_MODULE_ROOTS, ...EXTENSION_PROOF_ROOTS]

/** The probe module and the probe provider as the generated registry would load them. */
export const loadProbeRecords = () => Promise.all([loadModuleRecord(PROBE_DIR), loadModuleRecord(PROBE_PROVIDER_DIR)])
