import type { BuildResult } from 'esbuild'

export function bundleHook(opts: {
  entry: string
  outfile: string
  format?: 'esm' | 'cjs'
  write?: boolean
}): Promise<BuildResult>
