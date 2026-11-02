/** Basic-auth passwords of the chat `serve` processes by URL (11c: a resumed TUI joins one via `--server`). */
const byUrl = new Map<string, string>()

/** Records the password of a running server; the returned function forgets it (on stop or exit). */
export function rememberServerPassword(url: string, password: string): () => void {
  byUrl.set(url, password)
  return () => {
    if (byUrl.get(url) === password) byUrl.delete(url)
  }
}

export const passwordForServerUrl = (url: string): string | undefined => byUrl.get(url)
