import { join } from 'node:path'
import {
  ASSET_PREFIX,
  ASSET_TARGETS,
  CASK_ARCH_ASSETS,
  CASK_VERSION,
  caskSha,
  DIST_DIR,
  NEWLINE,
  SUMS_LINE,
  VERSION_WORD,
} from './constants.ts'

const assetName = (version: string, suffix: string): string => `${ASSET_PREFIX}${version}-${suffix}`

/** Release assets as built by `pnpm package:all`: `dist/<target>/pragma-ade-<version>-<suffix>`. */
export function expectedAssets(version: string): string[] {
  return ASSET_TARGETS.flatMap((t) => t.files.map((f) => join(DIST_DIR, t.dir, assetName(version, f))))
}

/** `sha256  name` lines (as written by `shasum -a 256`) → name → sha256. */
export function parseSums(text: string): Map<string, string> {
  const sums = new Map<string, string>()
  for (const line of text.split(NEWLINE)) {
    const g = SUMS_LINE.exec(line.trim())?.groups
    if (g?.sha && g.name) sums.set(g.name, g.sha)
  }
  return sums
}

function replaceOnce(text: string, re: RegExp, value: string, what: string): string {
  if (!re.test(text)) throw new Error(`cask has no ${what} line`)
  return text.replace(re, `$1${value}$2`)
}

/** Sets the cask `version` and the per-arch `sha256 arm:/intel:` values from the mac zip checksums. */
export function updateCask(cask: string, version: string, sumsText: string): string {
  const sums = parseSums(sumsText)
  let out = replaceOnce(cask, CASK_VERSION, version, VERSION_WORD)
  for (const [arch, suffix] of Object.entries(CASK_ARCH_ASSETS)) {
    const sha = sums.get(assetName(version, suffix))
    if (!sha) throw new Error(`SHA256SUMS has no ${assetName(version, suffix)}`)
    out = replaceOnce(out, caskSha(arch), sha, `sha256 ${arch}:`)
  }
  return out
}
