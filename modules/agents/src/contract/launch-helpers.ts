import type { LaunchContext, LaunchSpec } from './launch'

/** The spec every provider starts from: profile command and args, worktree cwd, a copy of `ctx.env`. */
export const baseLaunchSpec = (ctx: LaunchContext): LaunchSpec => ({
  command: ctx.profile.command,
  args: [...ctx.profile.args],
  env: { ...ctx.env },
  cwd: ctx.worktreePath,
})

/** The initial prompt, unless it is missing or blank (passed on byte for byte otherwise). */
export const initialPromptOf = (ctx: Pick<LaunchContext, 'initialPrompt'>): string | undefined =>
  ctx.initialPrompt?.trim() ? ctx.initialPrompt : undefined
