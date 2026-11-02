import { createRequire } from 'node:module'
import { DEP } from '../constants.ts'

/**
 * The tool's own npm dependencies (scripts/package/node_modules) are loaded through non-literal specifiers:
 * the root `tsc -p tsconfig.node.json` type-checks `scripts/**` and must pass before `npm ci` ran here.
 */
const requireHere = createRequire(import.meta.url)

export interface YamlModule {
  parse(text: string): unknown
}
export const loadYaml = (): YamlModule => requireHere(DEP.yaml) as YamlModule

export interface AsarModule {
  listPackage(archive: string, options: { isPack: boolean }): string[]
}
export const loadAsar = async (): Promise<AsarModule> => (await import(DEP.asar)) as AsarModule

export interface BuilderTargets {
  readonly size: number
}
export interface BuilderPlatform {
  createTarget(targets: readonly string[], ...arches: number[]): BuilderTargets
}
export interface ElectronBuilderModule {
  Platform: Record<'MAC' | 'LINUX' | 'WINDOWS', BuilderPlatform>
  Arch: Record<'x64' | 'arm64', number>
  build(options: {
    projectDir: string
    config: Record<string, unknown>
    publish: 'never'
    targets: BuilderTargets
  }): Promise<string[]>
}
export const loadElectronBuilder = async (): Promise<ElectronBuilderModule> =>
  (await import(DEP.builder)) as ElectronBuilderModule
