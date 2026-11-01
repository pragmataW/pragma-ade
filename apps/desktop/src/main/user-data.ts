import { USER_DATA_ENV } from '@pragma/sdk'

/** `PRAGMA_USER_DATA` wins (tests, multiple instances); otherwise Electron's default userData path. */
export function resolveUserDataDir(env: Record<string, string | undefined>, fallback: string): string {
  const override = env[USER_DATA_ENV]?.trim()
  return override ? override : fallback
}
