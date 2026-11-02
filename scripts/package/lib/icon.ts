import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ICON_RENDER_TIMEOUT_MS, ICON_SIZE_PX } from '../constants.ts'
import { run } from './exec.ts'
import { mkTemp } from './fsx.ts'

/** Electron main script (CommonJS) that renders an SVG offscreen and writes the PNG. */
const RENDER_SCRIPT = `
const { app, BrowserWindow } = require('electron')
const { writeFileSync } = require('node:fs')
const [svg, png, size] = process.argv.slice(-3)
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const s = Number(size)
  const win = new BrowserWindow({ width: s, height: s, show: false, transparent: true, frame: false,
    useContentSize: true, webPreferences: { offscreen: true, zoomFactor: 1 } })
  const html = '<html><body style="margin:0;background:transparent"><img width="' + s + '" height="' + s +
    '" src="data:image/svg+xml;base64,' + require('node:fs').readFileSync(svg).toString('base64') + '"></body></html>'
  await win.loadURL('data:text/html;base64,' + Buffer.from(html).toString('base64'))
  await new Promise((r) => setTimeout(r, 500))
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: s, height: s })
  writeFileSync(png, image.resize({ width: s, height: s }).toPNG())
  app.quit()
})
`

/** svg → png (ICON_SIZE_PX square) with the repo's Electron. */
export async function renderIcon(electronBinary: string, svgPath: string, pngPath: string): Promise<void> {
  const dir = mkTemp('icon render')
  const script = join(dir, 'render.cjs')
  writeFileSync(script, RENDER_SCRIPT)
  await run(electronBinary, [script, svgPath, pngPath, String(ICON_SIZE_PX)], { timeoutMs: ICON_RENDER_TIMEOUT_MS })
}
