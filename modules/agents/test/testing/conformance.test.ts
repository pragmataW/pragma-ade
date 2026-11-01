import { describeLaunchCapability } from '../../testing'

describeLaunchCapability('trivial', () => ({
  buildLaunch: async (c) => ({
    command: c.profile.command,
    args: c.profile.args,
    env: { ...c.env },
    cwd: c.worktreePath,
  }),
}))
