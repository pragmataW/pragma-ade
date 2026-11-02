import { AgentStatusServiceToken } from '@pragma/module-agent-status/contract'
import { AgentSessionsServiceToken } from '@pragma/module-agents/contract'
import { fakeMainCtx } from '@pragma/module-git-changes/testing'
import { GitServiceToken, ProjectsServiceToken } from '@pragma/module-projects/contract'
import type { ServiceToken } from '@pragma/sdk'
import type { MainContext } from '@pragma/sdk/main'
import { BOARD_SETTINGS_DEFAULTS, type BoardService, BoardServiceToken, type BoardSettings } from '../../src/contract'
import mainModule from '../../src/main'
import { openTestDb } from './db'
import { fakeAgentSessions, fakeGit, fakeProjects, fakeStatus } from './fakes'

/** The real main module activated on a fake `MainContext` (git-changes' `fakeMainCtx`) with a temp DB. */
export async function activateBoard(o: { withStatus?: boolean } = {}) {
  const db = await openTestDb()
  const projects = fakeProjects()
  const sessions = fakeAgentSessions()
  const status = o.withStatus ? fakeStatus() : undefined
  const services: [ServiceToken<unknown>, unknown][] = [
    [ProjectsServiceToken, projects.service],
    [GitServiceToken, fakeGit()],
    [AgentSessionsServiceToken, sessions.service],
  ]
  if (status) services.push([AgentStatusServiceToken, status.service])
  const fake = fakeMainCtx<BoardSettings>({ settings: BOARD_SETTINGS_DEFAULTS, services })
  const ctx = { ...fake.ctx, db: db.opened.db } as MainContext<BoardSettings>
  await mainModule.activate(ctx)
  const service = ctx.services.get(BoardServiceToken) as BoardService
  return { fake, ctx, projects, sessions, status, service }
}
