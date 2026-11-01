// Shared esbuild setup for the provider hook bundles (providers/*/packages/hooks/build.mjs) and the zod-free tests.
// Workspace sources are marked side-effect free, so a hook that imports one constant from a module contract does not
// pull in the rest of that contract (zod schemas, the SDK).
import { build } from 'esbuild'

const NODE_MODULES = /[\\/]node_modules[\\/]/
const PLUGIN = 'pragma-pure-workspace-sources'

const pureWorkspaceSources = {
  name: PLUGIN,
  setup(b) {
    b.onResolve({ filter: /.*/ }, async (args) => {
      if (args.pluginData === PLUGIN || args.kind === 'entry-point') return undefined
      const r = await b.resolve(args.path, {
        kind: args.kind,
        importer: args.importer,
        resolveDir: args.resolveDir,
        pluginData: PLUGIN,
      })
      if (r.errors.length > 0 || r.external || NODE_MODULES.test(r.path)) return undefined
      return { path: r.path, sideEffects: false }
    })
  },
}

/** Bundles one hook entry for Node 22 (no dependencies at runtime). */
export function bundleHook({ entry, outfile, format = 'esm', write = true }) {
  return build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format,
    target: 'node22',
    outfile,
    write,
    plugins: [pureWorkspaceSources],
    minifySyntax: true,
    logLevel: 'warning',
  })
}
