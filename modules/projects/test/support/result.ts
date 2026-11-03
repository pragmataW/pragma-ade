/** The value of an ok `Result` IPC answer; an error result fails the test. */
export const unwrap = <T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(`unexpected error result ${JSON.stringify(r.error)}`)
  return r.value
}
