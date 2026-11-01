export interface Violation {
  rule: string
  /** Path relative to the scanned root. */
  file: string
  line: number
  message: string
}

export const formatViolations = (violations: readonly Violation[]): string =>
  violations.map((v) => `${v.file}:${v.line}  [${v.rule}]  ${v.message}`).join('\n')
