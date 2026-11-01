/** Every generator problem, reported together. */
export class GenerateError extends Error {
  readonly problems: string[]
  constructor(problems: string[]) {
    super(`gen-modules found ${problems.length} problem(s):\n${problems.map((p) => `  ✗ ${p}`).join('\n')}`)
    this.name = 'GenerateError'
    this.problems = problems
  }
}
