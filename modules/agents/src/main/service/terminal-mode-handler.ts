import { TERMINAL_TAG_OWNER } from '@pragma/module-terminal/contract'
import type { Logger } from '@pragma/sdk'
import { DEFAULT_PTY_COLS, DEFAULT_PTY_ROWS, PTY_TAG_SESSION, SIGKILL, SIGTERM } from '../../constants'
import {
  AGENTS_ERROR,
  AGENTS_MODULE_ID,
  type AgentSessionModeHandler,
  type ModeStartRequest,
  STOP_SIGNAL,
} from '../../contract'
import type { LaunchContextFactory } from '../launch/context'
import { type LaunchPipelineDeps, type LaunchPlan, runLaunchPipeline } from '../launch/launch-pipeline'
import type { SessionTempDirs } from '../launch/session-temp'
import { toAgentsError } from '../lib/errors'
import type { PtyAccess } from './deps'

export interface TerminalModeDeps {
  pty: PtyAccess
  pipeline: LaunchPipelineDeps
  contextFactory: LaunchContextFactory
  tempDirs: Pick<SessionTempDirs, 'remove'>
  log: Logger
}

/** The `terminal` mode: the launch pipeline, then a pty from 02 (`PtyService`); exit comes from `onExit`. */
export function createTerminalModeHandler(deps: TerminalModeDeps): AgentSessionModeHandler {
  const { pty, tempDirs, log } = deps

  async function plan(req: ModeStartRequest): Promise<LaunchPlan> {
    const ctx = await deps.contextFactory({ ...req, session: req.session })
    try {
      return await runLaunchPipeline(deps.pipeline, ctx)
    } catch (error) {
      await tempDirs.remove(req.session.id)
      throw error
    }
  }

  return {
    async start(req) {
      const sessionId = req.session.id
      const { spec, resolvedCommand, env } = await plan(req)
      let ptyId: string
      try {
        ptyId = await pty.spawn({
          cwd: spec.cwd,
          command: resolvedCommand,
          args: spec.args,
          env,
          cols: DEFAULT_PTY_COLS,
          rows: DEFAULT_PTY_ROWS,
          tags: { [TERMINAL_TAG_OWNER]: AGENTS_MODULE_ID, [PTY_TAG_SESSION]: sessionId },
        })
      } catch (error) {
        await tempDirs.remove(sessionId, spec.tempFiles)
        throw toAgentsError(error, AGENTS_ERROR.spawnFailed)
      }
      pty.onExit(ptyId, (e) => {
        void tempDirs
          .remove(sessionId, spec.tempFiles)
          .catch((error) => log.warn(`temp cleanup of ${sessionId} failed`, error))
          .finally(() => req.reportExit(e.exitCode ?? null))
      })
      return { ptyId }
    },
    async stop(session, signal) {
      if (!session.ptyId) return
      const sig = signal === STOP_SIGNAL.kill ? SIGKILL : SIGTERM
      void pty.kill(session.ptyId, sig).catch((error) => log.warn(`kill ${sig} of ${session.id} failed`, error))
    },
  }
}
