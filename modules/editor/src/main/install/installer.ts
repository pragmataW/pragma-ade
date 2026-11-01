import { existsSync } from 'node:fs'
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { DOWNLOADS_DIR, EDITOR_DIR, DOWNLOAD_FAILURE as F, TMP_DIR_INFIX } from '../../constants'
import { EDITOR_ERROR, EDITOR_STATE, type EditorErrorKey, type EditorStatus, editorErrorI18nKey } from '../../contract'
import { type EditorRelease, isResolved, type ResolvedAsset, resolveAsset } from '../release/release'
import { type DownloadResult, downloadVerified, sha256File } from './download'
import { extractInstall, hasInstallMarker, isInstalled } from './extract'

export interface InstallerDeps {
  userDataDir: string
  release: EditorRelease
  platform: NodeJS.Platform
  arch: string
  fetchImpl?: typeof fetch
  /** Test only: copy the archive from here when its sha matches. */
  downloadCacheDir?: string
  /** Test only: an already extracted server root used as the install dir. */
  installRootOverride?: string
}

type Listener = (s: EditorStatus) => void

const NOT_RETRYABLE: readonly EditorErrorKey[] = [EDITOR_ERROR.unsupportedPlatform]

const downloadErrorKey = (r: Exclude<DownloadResult, { ok: true }>): EditorErrorKey =>
  r.reason === F.checksumMismatch ? EDITOR_ERROR.checksumMismatch : EDITOR_ERROR.downloadFailed

const downloadDetail = (r: Exclude<DownloadResult, { ok: true }>): string | undefined => {
  switch (r.reason) {
    case F.checksumMismatch:
      return `actual sha256 ${r.actual}`
    case F.http:
      return `HTTP ${r.status}`
    case F.network:
      return r.message
    case F.aborted:
      return undefined
    default: {
      const never: never = r
      return never
    }
  }
}

class Cancelled extends Error {}
class InstallFailed extends Error {
  readonly key: EditorErrorKey
  readonly detail: string | undefined
  constructor(key: EditorErrorKey, detail?: string) {
    super(key)
    this.key = key
    this.detail = detail
  }
}

/** Download → verify → extract state machine for the pinned release (`userData/editor/<version>`). */
export class EditorInstaller {
  readonly installDir: string
  readonly #deps: InstallerDeps
  readonly #listeners = new Set<Listener>()
  #status: EditorStatus
  #running: Promise<EditorStatus> | undefined
  #abort: AbortController | undefined

  constructor(deps: InstallerDeps) {
    this.#deps = deps
    this.installDir = deps.installRootOverride ?? join(this.#editorDir, deps.release.version)
    this.#status = this.#notInstalled()
  }

  get #editorDir(): string {
    return join(this.#deps.userDataDir, EDITOR_DIR)
  }

  get binRelPath(): string {
    const { binPath } = this.#deps.release
    return this.#deps.platform === 'win32' ? binPath.win32 : binPath.posix
  }

  status(): EditorStatus {
    return this.#status
  }

  onStatus(cb: Listener): () => void {
    this.#listeners.add(cb)
    return () => void this.#listeners.delete(cb)
  }

  /** Idempotent; concurrent calls share one run. Resolves `starting` once installed. */
  ensureInstalled(): Promise<EditorStatus> {
    this.#running ??= this.#run().finally(() => {
      this.#running = undefined
    })
    return this.#running
  }

  cancel(): void {
    this.#abort?.abort()
  }

  async reinstall(): Promise<EditorStatus> {
    this.cancel()
    await this.#running?.catch(() => undefined)
    if (!this.#deps.installRootOverride) await rm(this.installDir, { recursive: true, force: true })
    this.#set(this.#notInstalled())
    return this.ensureInstalled()
  }

  #notInstalled(): EditorStatus {
    const asset = this.#asset()
    const sizeBytes = isResolved(asset) ? asset.sizeBytes : 0
    return { state: EDITOR_STATE.notInstalled, version: this.#deps.release.version, sizeBytes }
  }

  #asset(): ResolvedAsset | { error: 'unsupportedPlatform' } {
    return resolveAsset(this.#deps.release, this.#deps.platform, this.#deps.arch)
  }

  #set(s: EditorStatus): EditorStatus {
    this.#status = s
    for (const cb of [...this.#listeners]) cb(s)
    return s
  }

  #installed(): EditorStatus {
    return this.#set({ state: EDITOR_STATE.starting, version: this.#deps.release.version })
  }

  async #run(): Promise<EditorStatus> {
    const { version } = this.#deps.release
    if (await isInstalled(this.installDir, version, this.binRelPath)) return this.#installed()
    try {
      const asset = this.#asset()
      if (!isResolved(asset)) throw new InstallFailed(EDITOR_ERROR.unsupportedPlatform)
      const archive = await this.#obtain(asset)
      this.#set({ state: EDITOR_STATE.extracting, version })
      const r = await extractInstall(archive, this.installDir, {
        stripComponents: this.#deps.release.stripComponents,
        binRelPath: this.binRelPath,
        version,
        sha256: asset.sha256,
      })
      if (!r.ok) throw new InstallFailed(EDITOR_ERROR.invalidArchive, r.detail)
      await this.#cleanup()
      return this.#installed()
    } catch (error) {
      return this.#fail(error)
    }
  }

  #fail(error: unknown): EditorStatus {
    const { version } = this.#deps.release
    if (error instanceof Cancelled) return this.#set(this.#notInstalled())
    const key = error instanceof InstallFailed ? error.key : EDITOR_ERROR.downloadFailed
    const detail = error instanceof InstallFailed ? error.detail : String(error)
    return this.#set({
      state: EDITOR_STATE.error,
      version,
      errorKey: editorErrorI18nKey(key),
      ...(detail ? { detail } : {}),
      retryable: !NOT_RETRYABLE.includes(key),
    })
  }

  /** The verified archive in `editor/downloads`: from the test cache, a previous download, or the network. */
  async #obtain(asset: ResolvedAsset): Promise<string> {
    const dest = join(this.#editorDir, DOWNLOADS_DIR, asset.file)
    await mkdir(dirname(dest), { recursive: true })
    if (await this.#verified(dest, asset.sha256)) return dest
    const cached = this.#deps.downloadCacheDir && join(this.#deps.downloadCacheDir, asset.file)
    if (cached && (await this.#verified(cached, asset.sha256))) {
      this.#set({ state: EDITOR_STATE.verifying, version: this.#deps.release.version })
      await copyFile(cached, dest)
      return dest
    }
    await this.#download(asset, dest)
    return dest
  }

  async #verified(file: string, sha: string): Promise<boolean> {
    return existsSync(file) && (await sha256File(file)) === sha
  }

  async #download(asset: ResolvedAsset, dest: string): Promise<void> {
    const { version } = this.#deps.release
    this.#abort = new AbortController()
    this.#set({ state: EDITOR_STATE.downloading, version, received: 0, total: asset.sizeBytes })
    const r = await downloadVerified({
      url: asset.url,
      dest,
      expectedSha256: asset.sha256,
      signal: this.#abort.signal,
      fetchImpl: this.#deps.fetchImpl,
      onProgress: (received, total) =>
        this.#set(
          received >= total
            ? { state: EDITOR_STATE.verifying, version }
            : { state: EDITOR_STATE.downloading, version, received, total },
        ),
    })
    this.#abort = undefined
    if (r.ok) return
    if (r.reason === F.aborted) throw new Cancelled()
    throw new InstallFailed(downloadErrorKey(r), downloadDetail(r))
  }

  /** Removes the downloads folder, other installed versions and leftover temp dirs. */
  async #cleanup(): Promise<void> {
    await rm(join(this.#editorDir, DOWNLOADS_DIR), { recursive: true, force: true })
    if (this.#deps.installRootOverride || !existsSync(this.#editorDir)) return
    for (const name of await readdir(this.#editorDir)) {
      const dir = join(this.#editorDir, name)
      if (dir === this.installDir) continue
      if (name.includes(TMP_DIR_INFIX) || hasInstallMarker(dir)) await rm(dir, { recursive: true, force: true })
    }
  }
}
