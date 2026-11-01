#!/usr/bin/env node
// Fake codium-server for unit and E2E tests: same flags, /version, token check, --install-extension.
import { spawn } from 'node:child_process'
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { basename, dirname, join } from 'node:path'

const argv = process.argv.slice(2)
const flag = (name) => {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}
const env = process.env
const log = (entry) => {
  if (env.FAKE_REH_LOG)
    appendFileSync(env.FAKE_REH_LOG, `${JSON.stringify({ pid: process.pid, ts: Date.now(), ...entry })}\n`)
}
log({ type: 'start', argv, env: { PRAGMA_BRIDGE_URL: env.PRAGMA_BRIDGE_URL, PRAGMA_TEST: env.PRAGMA_TEST } })

/** Misbehaviour runs once when FAKE_REH_ONCE_MARKER is set (the marker file is created by the first run). */
const misbehave = () => {
  const marker = env.FAKE_REH_ONCE_MARKER
  if (!marker) return true
  if (existsSync(marker)) return false
  writeFileSync(marker, String(process.pid))
  return true
}

const vsix = flag('--install-extension')
if (vsix) {
  if (env.FAKE_REH_INSTALL_FAIL === '1') {
    console.error('install failed (fake)')
    process.exit(1)
  }
  const manifest = join(dirname(vsix), 'manifest.json')
  const version = existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')).version : '0.0.0'
  const target = join(flag('--extensions-dir'), `pragma.pragma-bridge-${version}`)
  mkdirSync(target, { recursive: true })
  copyFileSync(vsix, join(target, basename(vsix)))
  log({ type: 'install', vsix, target })
  console.log(`Extension '${basename(vsix)}' was successfully installed.`)
  process.exit(0)
}

const token = readFileSync(flag('--connection-token-file'), 'utf8').trim()
const port = Number(flag('--port'))
const host = flag('--host') ?? '127.0.0.1'
const COOKIE = 'vscode-tkn'
const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
const bad = misbehave()
const startedAt = Date.now()
const hangAfter = env.FAKE_REH_HANG_VERSION === '1' ? 0 : Number(env.FAKE_REH_HANG_AFTER_MS ?? Number.NaN)

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${host}:${port}`)
  if (url.pathname === '/version') {
    if (bad && Date.now() - startedAt >= hangAfter) return // never answers
    res.end('fake-commit')
    return
  }
  const cookieOk = (req.headers.cookie ?? '').includes(`${COOKIE}=${token}`)
  if (url.searchParams.get('tkn') === token) {
    url.searchParams.delete('tkn')
    res.writeHead(302, { location: `${url.pathname}${url.search}`, 'set-cookie': `${COOKIE}=${token}; Path=/` })
    res.end()
    return
  }
  if (!cookieOk) {
    res.writeHead(403)
    res.end('Forbidden.')
    return
  }
  const folder = url.searchParams.get('folder') ?? ''
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(`<!doctype html><title>fake-workbench</title><body><pre id="folder">${escapeHtml(folder)}</pre></body>`)
})
server.listen(port, host, () => {
  console.log(`Web UI available at http://localhost:${port}?tkn=${token}`)
  log({ type: 'listening', port })
})

if (env.FAKE_REH_SPAWN_CHILD === '1') {
  const child = spawn('sleep', ['600'], { stdio: 'ignore' })
  log({ type: 'child', childPid: child.pid })
}
const crashAfter = Number(env.FAKE_REH_CRASH_AFTER_MS ?? Number.NaN)
if (bad && Number.isFinite(crashAfter)) setTimeout(() => process.exit(1), crashAfter)
process.on('SIGTERM', () => process.exit(0))
