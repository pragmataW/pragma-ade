import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import type { Plugin } from 'vite'

const NATIVE_MARKERS = ['binding.gyp', 'prebuilds', 'build/Release'] as const
const BARE = /^(?<name>@[^/]+\/[^/]+|[^./][^/]*)/
const PACKAGE_JSON = 'package.json'
const PLUGIN_NAME = 'pragma:native-externals'

/** A package with compiled code (node-gyp, prebuilds) cannot be bundled. */
export const isNativePackageDir = (dir: string): boolean => NATIVE_MARKERS.some((m) => existsSync(join(dir, m)))

function packageDirOf(source: string, importer: string): string | undefined {
  const name = BARE.exec(source)?.groups?.name
  if (!name || source.startsWith('node:')) return undefined
  try {
    return dirname(createRequire(importer).resolve(`${name}/${PACKAGE_JSON}`))
  } catch {
    return undefined
  }
}

/** Marks native dependencies of any workspace package as relative externals (they load from node_modules). */
export function nativeExternals(): Plugin {
  return {
    name: PLUGIN_NAME,
    enforce: 'pre',
    async resolveId(source, importer) {
      if (!importer) return null
      const dir = packageDirOf(source, importer)
      if (!dir || !isNativePackageDir(dir)) return null
      const resolved = await this.resolve(source, importer, { skipSelf: true })
      return resolved ? { id: resolved.id, external: 'relative' } : null
    },
  }
}
