/** Shared unit-test fakes (§9: no copy-pasted setup). */

/** A `writeTempFile` recorder; returns `path` (default `/tmp/s/<name>`). */
export function fakeWriter(path?: string) {
  const calls: [string, string][] = []
  return {
    calls,
    async writeTempFile(name: string, contents: string): Promise<string> {
      calls.push([name, contents])
      return path ?? `/tmp/s/${name}`
    },
  }
}
