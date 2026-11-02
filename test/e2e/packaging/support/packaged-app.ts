import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { appLayout, extractArchive } from '../../../../scripts/package/lib/archive.ts'
import { DistManifestSchema } from '../../../../scripts/package/lib/schema.ts'
import { TARGETS } from '../../../../scripts/package/lib/targets.ts'
import { EXECUTABLE_NAME, PRODUCT_NAME, type SmokeTarget, smokeDist } from './constants'

export interface PackagedApp {
  executablePath: string
  resourcesDir: string
}

/** The target's zip from dist/manifest.json, extracted (nothing is launched); null when it was not built. */
export async function extractPackagedApp(target: SmokeTarget): Promise<PackagedApp | null> {
  const file = join(smokeDist(), 'manifest.json')
  if (!existsSync(file)) return null
  const manifest = DistManifestSchema.parse(JSON.parse(readFileSync(file, 'utf8')))
  const report = manifest.targets[target]
  const zip = report?.status === 'ok' ? report.artifacts.find((a) => a.endsWith('.zip')) : undefined
  if (!zip || !existsSync(zip)) return null
  const root = await extractArchive(zip)
  const layout = appLayout(root, TARGETS[target], { productName: PRODUCT_NAME, executableName: EXECUTABLE_NAME })
  return { executablePath: layout.executable, resourcesDir: layout.resourcesDir }
}
