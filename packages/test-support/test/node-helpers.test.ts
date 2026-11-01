import { existsSync, writeFileSync } from 'node:fs'
import { get } from 'node:http'
import { join } from 'node:path'
import { CoreIpc } from '@pragma/sdk'
import { afterAll, describe, expect, it, test } from 'vitest'
import {
  createFakePlatform,
  createFixtureRepo,
  createTempUserData,
  createTestModuleHost,
  findRepoRoot,
  loadModuleRecord,
  startStaticServer,
} from '../src/node/index'

test('findRepoRoot finds the workspace root', () => {
  expect(existsSync(join(findRepoRoot(), 'pnpm-workspace.yaml'))).toBe(true)
})

test('temp dir lifecycle', () => {
  const temp = createTempUserData()
  expect(existsSync(temp.path)).toBe(true)
  temp.cleanup()
  expect(existsSync(temp.path)).toBe(false)
})

describe('fixture repo', () => {
  const repo = createFixtureRepo({ files: { 'README.md': '# hi\n' } })
  afterAll(() => repo.cleanup())
  test('on main with an isolated author', () => {
    expect(repo.git('branch', '--show-current')).toBe('main')
    expect(repo.git('log', '-1', '--format=%an <%ae>')).toBe('Pragma Test <test@pragma.invalid>')
  })
  test('commit() returns a sha', () => {
    const sha = repo.commit('second', { 'a.txt': 'a' })
    expect(sha).toMatch(/^[0-9a-f]{40}$/)
    expect(repo.git('rev-parse', 'HEAD')).toBe(sha)
  })
})

test('loadModuleRecord plus a test host activate an inline temp module', async () => {
  const temp = createTempUserData()
  const repo = createFixtureRepo({
    commit: false,
    files: {
      'hello/package.json': JSON.stringify({
        name: '@pragma/module-hello',
        version: '1.2.3',
        exports: { './main': './src/main/index.ts' },
        pragma: { id: 'hello', kind: 'feature', displayNameKey: 'hello:module.name' },
      }),
      'hello/locales/en.json': JSON.stringify({ module: { name: 'Hello' } }),
      'hello/src/main/index.ts':
        "export default { activate: (ctx) => void ctx.commands.register('hello.hi', () => 'hi') }\n",
    },
  })
  const record = await loadModuleRecord(join(repo.path, 'hello'))
  expect(record).toMatchObject({ version: '1.2.3', locales: { en: { module: { name: 'Hello' } } } })
  const t = await createTestModuleHost({ modules: [record], userDataDir: temp.path })
  expect(await t.ipc.invoke(CoreIpc.commandsExecute, { id: 'hello.hi' })).toBe('hi')
  expect((await t.ipc.invoke(CoreIpc.modulesList, undefined))[0]?.state).toBe('active')
  await t.dispose()
  repo.cleanup()
  temp.cleanup()
  expect(existsSync(repo.path)).toBe(false)
})

test('fake platform records dialog calls and toggles dark', async () => {
  const platform = createFakePlatform({ dark: false, dialogReplies: { openFolder: '/x' } })
  expect(await platform.dialogs.openFolder({ title: 'T' })).toBe('/x')
  expect(platform.calls).toEqual([{ method: 'dialogs.openFolder', args: [{ title: 'T' }] }])
  expect(platform.theme.shouldUseDark()).toBe(false)
  platform.setDark(true)
  expect(platform.theme.shouldUseDark()).toBe(true)
})

/** Sends the path verbatim (fetch would normalise `..`). */
const rawGet = (port: number, path: string) =>
  new Promise<{ status: number; type: string | undefined; body: string }>((resolve, reject) => {
    get({ host: '127.0.0.1', port, path }, (res) => {
      let body = ''
      res.on('data', (chunk) => {
        body += chunk
      })
      res.on('end', () => resolve({ status: res.statusCode ?? 0, type: res.headers['content-type'], body }))
    }).on('error', reject)
  })

describe('startStaticServer', () => {
  const site = createTempUserData()
  writeFileSync(join(site.path, 'index.html'), '<h1>home</h1>')
  writeFileSync(join(site.path, 'app.js'), 'console.log(1)')
  afterAll(() => site.cleanup())
  it.each([
    ['/', 200, 'text/html', '<h1>home</h1>'],
    ['/app.js', 200, 'text/javascript', 'console.log(1)'],
    ['/../secret', 403, undefined, undefined],
    ['/missing.txt', 404, undefined, undefined],
  ])('GET %s → %i', async (path, status, type, body) => {
    const server = await startStaticServer(site.path)
    const res = await rawGet(server.port, path)
    expect(res.status).toBe(status)
    if (type) expect(res.type).toContain(type)
    if (body) expect(res.body).toBe(body)
    await server.close()
  })
  test('close() frees the port', async () => {
    const server = await startStaticServer(site.path)
    await server.close()
    const again = await startStaticServer(site.path, { port: server.port })
    expect(again.port).toBe(server.port)
    await again.close()
  })
})
