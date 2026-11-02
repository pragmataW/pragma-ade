import { existsSync, readdirSync, statSync } from 'node:fs'
import { open } from 'node:fs/promises'
import { basename, join } from 'node:path'
import {
  APP_BUNDLE_EXT,
  ARCHIVE_EXT,
  ASAR_UNPACKED_SUFFIX,
  AUDIT_DETAIL_LIMIT,
  BLOCKMAP_EXT,
  CODESIGN,
  DARWIN,
  DEB_ARCH_FIELD,
  DEB_ARCHITECTURE,
  DEB_CONTROL_MEMBER,
  DEB_CONTROL_PREFIX,
  DEB_INSTALL_ROOT,
  EXEC_BITS,
  FILE_BIN,
  LINUX,
  LIST_SEP,
  MAGIC_SCAN_BYTES,
  MISSING,
  NATIVE_EXT,
  NODE_MODULES,
  NSIS_MARKER,
  SEVERITY,
  SPAWN_HELPER,
  SQUASHFS_MAGIC,
  TAR,
  WIN32,
} from '../constants.ts'
import { appLayout, extractArchive, nativeRoots } from './archive.ts'
import { detectBinary, detectBinaryFile, matchesTarget } from './binary-arch.ts'
import { loadAsar } from './deps.ts'
import { run } from './exec.ts'
import { sha256File, walkFiles } from './fsx.ts'
import { findNativePackages, isSatisfied, type NativePackage } from './natives.ts'
import { probeHost, probeLinuxInDocker } from './probe.ts'
import {
  type AuditCheck,
  type AuditCheckId,
  type AuditExpectations,
  type AuditResult,
  CHECK,
  type NativeFileReport,
} from './schema.ts'
import { FORMAT, type Target } from './targets.ts'

export { AUDIT_CHECK_IDS } from './schema.ts'

type TreeAudit = Pick<AuditResult, 'checks' | 'nativeFiles'>

const check = (id: AuditCheckId, ok: boolean, detail: string, subject?: string): AuditCheck => ({
  id,
  ok,
  severity: SEVERITY.error,
  detail,
  ...(subject === undefined ? {} : { subject }),
})
const listDetail = (items: readonly string[], none: string): string =>
  items.length === 0
    ? none
    : `${items.slice(0, AUDIT_DETAIL_LIMIT).join(LIST_SEP)}${items.length > AUDIT_DETAIL_LIMIT ? ` (+${items.length - AUDIT_DETAIL_LIMIT})` : ''}`

async function binariesCheck(files: readonly string[], target: Target, root: string): Promise<AuditCheck> {
  const foreign: string[] = []
  for (const f of files) {
    const info = await detectBinaryFile(f)
    if (info && !matchesTarget(info, target))
      foreign.push(`${f.slice(root.length + 1)} (${info.format} ${info.arches.join('+')})`)
  }
  return check(CHECK.binariesArch, foreign.length === 0, listDetail(foreign, `all binaries are ${target.id}`))
}

async function execBitCheck(files: readonly string[], target: Target): Promise<AuditCheck[]> {
  if (target.platform === WIN32) return []
  const missing: string[] = []
  for (const f of files) {
    const needsExec = basename(f) === SPAWN_HELPER || (await detectBinaryFile(f))?.executable === true
    if (needsExec && (statSync(f).mode & EXEC_BITS) === 0) missing.push(f)
  }
  return [check(CHECK.execBit, missing.length === 0, listDetail(missing, 'helpers and executables are executable'))]
}

async function nativesChecks(roots: readonly string[], target: Target, exp: AuditExpectations): Promise<AuditCheck[]> {
  const found: NativePackage[] = []
  for (const root of roots) found.push(...(await findNativePackages(root, target)))
  return exp.nativePackages.map((name) => {
    const hits = found.filter((p) => p.name === name)
    const ok = hits.length > 0 && hits.every((p) => isSatisfied(p, found))
    return check(
      'natives.present',
      ok,
      ok ? `${hits.length} copy(ies) with a ${target.id} binary` : 'missing or no target binary',
      name,
    )
  })
}

async function asarChecks(asar: string, main: string): Promise<AuditCheck[]> {
  if (!existsSync(asar)) return [check(CHECK.asarMain, false, `${asar} is missing`)]
  const { listPackage } = await loadAsar()
  const entries = listPackage(asar, { isPack: false })
  // listPackage also lists unpacked files; a `.node` is fine when it exists in app.asar.unpacked
  const inside = entries.filter((e) => e.endsWith(NATIVE_EXT) && !existsSync(`${asar}${ASAR_UNPACKED_SUFFIX}${e}`))
  return [
    check(CHECK.nativesUnpacked, inside.length === 0, listDetail(inside, 'no .node inside app.asar')),
    check(CHECK.asarMain, entries.includes(`/${main}`), main),
  ]
}

async function nativeFileReports(roots: readonly string[], target: Target): Promise<NativeFileReport[]> {
  const files = roots.flatMap((r) => walkFiles(join(r, NODE_MODULES)).filter((f) => f.endsWith(NATIVE_EXT)))
  const out: NativeFileReport[] = []
  for (const path of files) {
    const fileCmd = (await run(FILE_BIN, ['-b', path], { allowFail: true })).stdout.trim()
    const info = await detectBinaryFile(path)
    out.push({ path, fileCmd, ok: info !== null && matchesTarget(info, target) })
  }
  return out
}

/** Checks of an extracted app tree (zip/deb payload or the `.app` dir's parent). */
export async function auditTree(root: string, target: Target, exp: AuditExpectations): Promise<TreeAudit> {
  const layout = appLayout(root, target, exp)
  const files = walkFiles(root)
  const exe = existsSync(layout.executable) ? await detectBinaryFile(layout.executable) : null
  const roots = nativeRoots(layout)
  const checks: AuditCheck[] = [
    await binariesCheck(files, target, root),
    check(CHECK.exeArch, exe !== null && matchesTarget(exe, target), layout.executable),
    ...(await nativesChecks(roots, target, exp)),
    ...(await asarChecks(layout.asar, exp.main)),
    ...exp.resourceDests.map((d) =>
      check(CHECK.resourcesPresent, existsSync(join(layout.resourcesDir, d)), join(layout.resourcesDir, d), d),
    ),
    ...(await execBitCheck(files, target)),
  ]
  return { checks, nativeFiles: await nativeFileReports(roots, target) }
}

async function headBytes(path: string): Promise<Buffer> {
  const handle = await open(path, 'r')
  try {
    const buf = Buffer.alloc(Math.min(MAGIC_SCAN_BYTES, statSync(path).size))
    await handle.read(buf, 0, buf.length, 0)
    return buf
  } finally {
    await handle.close()
  }
}

const artifactOf = (outputDir: string, ext: string): string | undefined =>
  readdirSync(outputDir)
    .filter((n) => n.endsWith(ext))
    .map((n) => join(outputDir, n))[0]

interface TargetAudit {
  checks: AuditCheck[]
  nativeFiles: NativeFileReport[]
  probe?: AuditResult['probe']
}

const missingArtifact = (ext: string): TargetAudit => ({
  checks: [check(CHECK.binariesArch, false, `no ${ext} artifact`)],
  nativeFiles: [],
})

async function auditDarwin(
  target: Target,
  outputDir: string,
  exp: AuditExpectations,
  deep: boolean,
): Promise<TargetAudit> {
  const zip = artifactOf(outputDir, ARCHIVE_EXT.zip)
  const dmg = artifactOf(outputDir, ARCHIVE_EXT.dmg)
  if (!zip) return missingArtifact(ARCHIVE_EXT.zip)
  const root = await extractArchive(zip)
  const tree = await auditTree(root, target, exp)
  const app = join(root, `${exp.productName}${APP_BUNDLE_EXT}`)
  const sign = await run(CODESIGN, ['--verify', '--deep', '--strict', app], { allowFail: true })
  tree.checks.push(check(CHECK.codesignVerify, sign.code === 0, sign.stderr.trim() || 'ad-hoc signature valid'))
  const dmgRoot = dmg ? await extractArchive(dmg).catch(() => null) : null
  const dmgExe = dmgRoot ? appLayout(dmgRoot, target, exp).executable : ''
  const dmgInfo = dmgExe && existsSync(dmgExe) ? await detectBinaryFile(dmgExe) : null
  tree.checks.push(check(CHECK.dmgMount, dmgInfo !== null && matchesTarget(dmgInfo, target), dmg ?? 'no .dmg artifact'))
  if (!deep) return tree
  const probe = await probeHost(appLayout(root, target, exp), target)
  tree.checks.push(check(CHECK.probe, probe.ok, JSON.stringify(probe.results)))
  return { ...tree, probe }
}

async function debControlArch(deb: string, target: Target): Promise<AuditCheck> {
  const root = await extractArchive(deb)
  const control = readdirSync(root).find((n) => n.startsWith(DEB_CONTROL_PREFIX))
  const text = control
    ? (await run(TAR, ['-xOf', control, DEB_CONTROL_MEMBER], { cwd: root, allowFail: true })).stdout
    : ''
  const arch = DEB_ARCH_FIELD.exec(text)?.[1] ?? MISSING
  return check(CHECK.debControlArch, arch === DEB_ARCHITECTURE[target.arch], `Architecture: ${arch}`)
}

async function auditLinux(
  target: Target,
  outputDir: string,
  exp: AuditExpectations,
  deep: boolean,
): Promise<TargetAudit> {
  const deb = artifactOf(outputDir, ARCHIVE_EXT.deb)
  const appImage = artifactOf(outputDir, ARCHIVE_EXT.appImage)
  if (!deb) return missingArtifact(ARCHIVE_EXT.deb)
  const root = await extractArchive(deb)
  const appRoot = join(root, DEB_INSTALL_ROOT, exp.productName)
  const tree = await auditTree(appRoot, target, exp)
  tree.checks.push(await debControlArch(deb, target))
  const head = appImage ? await headBytes(appImage) : Buffer.alloc(0)
  const elf = detectBinary(head)
  const squash = head.indexOf(SQUASHFS_MAGIC) > 0
  tree.checks.push(
    check(
      'appimage.format',
      elf?.format === FORMAT.elf && matchesTarget(elf, target) && squash,
      appImage ?? 'no AppImage',
    ),
  )
  if (!deep) return tree
  const probe = await probeLinuxInDocker(appRoot, appLayout(appRoot, target, exp), target)
  tree.checks.push({
    ...check(CHECK.probe, probe.ok, probe.skipped ?? JSON.stringify(probe.results)),
    severity: SEVERITY.warn,
  })
  return { ...tree, probe }
}

async function auditWin(target: Target, outputDir: string, exp: AuditExpectations): Promise<TargetAudit> {
  const zip = artifactOf(outputDir, ARCHIVE_EXT.zip)
  const setup = artifactOf(outputDir, ARCHIVE_EXT.exe)
  if (!zip) return missingArtifact(ARCHIVE_EXT.zip)
  const tree = await auditTree(await extractArchive(zip), target, exp)
  const head = setup ? await headBytes(setup) : Buffer.alloc(0)
  const pe = detectBinary(head)
  // the NSIS stub is a 32-bit PE for every target arch; the payload is checked through the zip
  const nsis = pe?.format === FORMAT.pe && pe.executable && head.includes(NSIS_MARKER)
  tree.checks.push(check(CHECK.nsisFormat, nsis, setup ?? 'no setup .exe'))
  return tree
}

function auditPlatform(target: Target, outputDir: string, exp: AuditExpectations, deep: boolean): Promise<TargetAudit> {
  switch (target.platform) {
    case DARWIN:
      return auditDarwin(target, outputDir, exp, deep)
    case LINUX:
      return auditLinux(target, outputDir, exp, deep)
    case WIN32:
      return auditWin(target, outputDir, exp)
    default: {
      const never: never = target.platform
      throw new Error(`unknown platform ${String(never)}`)
    }
  }
}

/** Extracts the target's artifacts from `outputDir` and audits them; `deep` adds the native runtime probe. */
export async function auditTarget(
  target: Target,
  outputDir: string,
  exp: AuditExpectations,
  o: { deep: boolean },
): Promise<AuditResult> {
  const names = existsSync(outputDir) ? readdirSync(outputDir).filter((n) => !n.endsWith(BLOCKMAP_EXT)) : []
  const artifacts = []
  for (const n of names) {
    const path = join(outputDir, n)
    if (statSync(path).isFile()) artifacts.push({ path, bytes: statSync(path).size, sha256: await sha256File(path) })
  }
  const result = await auditPlatform(target, outputDir, exp, o.deep)
  const ok = result.checks.every((c) => c.ok || c.severity !== SEVERITY.error)
  return { target: target.id, ok, artifacts, ...result }
}
