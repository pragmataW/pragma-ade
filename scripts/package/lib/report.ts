import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import {
  BYTES_PER_MB,
  DIST_BIOME_CONFIG,
  DIST_BIOME_FILE,
  EXIT,
  JSON_INDENT,
  LIST_SEP,
  MANIFEST_FILE,
  MB_DECIMALS,
  MISSING,
  SHA_PREFIX_CHARS,
  STATUS,
  SUMMARY_FILE,
  UTF8,
} from '../constants.ts'
import { type DistManifest, DistManifestSchema, type TargetReport } from './schema.ts'
import { TARGET_IDS, type TargetId } from './targets.ts'

const CELL_BREAK = '<br>'
const NONE = 'None.'

export type ExitCode = (typeof EXIT)[keyof typeof EXIT]

/** The manifest in `distDir`, or null when there is none (or it no longer validates). */
export function readManifest(distDir: string): DistManifest | null {
  const file = join(distDir, MANIFEST_FILE)
  if (!existsSync(file)) return null
  const parsed = DistManifestSchema.safeParse(JSON.parse(readFileSync(file, UTF8)))
  return parsed.success ? parsed.data : null
}

const mb = (path: string): string =>
  existsSync(path) ? `${(statSync(path).size / BYTES_PER_MB).toFixed(MB_DECIMALS)} MB` : MISSING

function targetRow(id: TargetId, r: TargetReport): string {
  const artifacts = r.artifacts.map((a) => `${basename(a)} (${mb(a)})`).join(CELL_BREAK)
  const natives = r.natives.map((n) => `${n.name}@${n.version} (${n.source})`).join(CELL_BREAK)
  const failing = (r.audit?.checks ?? []).filter((c) => !c.ok).map((c) => `${c.id}${c.subject ? ` ${c.subject}` : ''}`)
  const status = r.status === STATUS.ok ? STATUS.ok : `**failed**${r.error ? `: ${r.error}` : ''}`
  return `| ${id} | ${status} | ${artifacts} | ${natives} | ${failing.join(LIST_SEP) || '—'} |`
}

function shaLines(m: DistManifest): string[] {
  return TARGET_IDS.flatMap((id) =>
    (m.targets[id]?.audit?.artifacts ?? []).map(
      (a) => `- \`${basename(a.path)}\` ${a.sha256.slice(0, SHA_PREFIX_CHARS)}…`,
    ),
  )
}

/** Human summary of a manifest (dist/SUMMARY.md). */
export function renderSummary(m: DistManifest): string {
  const rows = TARGET_IDS.flatMap((id) => {
    const r = m.targets[id]
    return r ? [targetRow(id, r)] : []
  })
  const smoke = m.smoke
  const lines = [
    `# Pragma ADE packages ${m.appVersion}`,
    '',
    `Generated ${m.generatedAt} from ${m.repoCommit ?? 'an unknown commit'}; Electron ${m.electronVersion}, electron-builder ${m.electronBuilderVersion}.`,
    '',
    '| Target | Status | Artifacts | Natives | Failing checks |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    '## sha256',
    ...shaLines(m),
    '',
    '## Built but not packaged',
    ...(m.unpackagedBuilds.length === 0
      ? [NONE]
      : m.unpackagedBuilds.map((b) => `- ${b.packageName} (${b.ownerId}): declare \`pragma.package.extraResources\``)),
    '',
    '## Warnings',
    ...(m.warnings.length === 0 ? [NONE] : m.warnings.map((w) => `- ${w}`)),
    '',
    '## Smoke',
    smoke
      ? `passed ${smoke.passed}, failed ${smoke.failed}, skipped ${smoke.skipped.length}`
      : 'Not run (`node scripts/package/cli.ts smoke`).',
    ...(smoke?.skipped ?? []).map((s) => `- skipped: ${s.title} — ${s.reason}`),
    ...(smoke?.failures ?? []).map((f) => `- failed: ${f.title} — ${f.error}`),
    '',
  ]
  return lines.join('\n')
}

/** Writes dist/manifest.json (targets merged into an existing one) and dist/SUMMARY.md; returns the merged manifest. */
export function writeManifest(distDir: string, m: DistManifest): DistManifest {
  const previous = readManifest(distDir)
  const merged = DistManifestSchema.parse({
    ...m,
    targets: { ...(previous?.targets ?? {}), ...m.targets },
    smoke: m.smoke ?? previous?.smoke,
  })
  mkdirSync(distDir, { recursive: true })
  writeFileSync(join(distDir, DIST_BIOME_FILE), DIST_BIOME_CONFIG)
  writeFileSync(join(distDir, MANIFEST_FILE), `${JSON.stringify(merged, null, JSON_INDENT)}\n`)
  writeFileSync(join(distDir, SUMMARY_FILE), renderSummary(merged))
  return merged
}

/** 1: a requested target failed or a smoke test failed; 2: incomplete (smoke skips, unpackaged builds); else 0. */
export function exitCodeFor(m: DistManifest, requested: readonly TargetId[]): ExitCode {
  const failed = requested.some((id) => m.targets[id]?.status !== STATUS.ok)
  if (failed || (m.smoke?.failed ?? 0) > 0) return EXIT.failed
  if ((m.smoke?.skipped.length ?? 0) > 0 || m.unpackagedBuilds.length > 0) return EXIT.incomplete
  return EXIT.ok
}
