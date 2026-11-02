import { resolve } from 'node:path'

export class UnsafeHomeError extends Error {
  constructor(home: string) {
    super(`refusing to write into the real home directory (${home}) in test mode`)
    this.name = 'UnsafeHomeError'
  }
}

/** In test mode (`PRAGMA_TEST=1`) every install must target a temp HOME, never the user's real one. */
export function assertSafeHome(home: string, o: { isTest: boolean; realHome: string }): void {
  if (o.isTest && resolve(home) === resolve(o.realHome)) throw new UnsafeHomeError(home)
}
