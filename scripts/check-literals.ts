import { relative, resolve } from 'node:path'
import { PARENT_DIR } from './lib/constants.ts'
import { checkLiterals } from './lib/literals.ts'

const repoRoot = resolve(import.meta.dirname, PARENT_DIR)
const { findings, allowances } = checkLiterals({ repoRoot })
const rel = (file: string): string => relative(repoRoot, file)

for (const f of findings) {
  const times = f.count === undefined ? '' : ` ×${f.count}`
  console.log(`${rel(f.file)}:${f.line}  ${f.rule}  ${f.value}${times}`)
}
console.log(`allowed exceptions: ${allowances.length}`)
for (const a of allowances) console.log(`  ${rel(a.file)}:${a.line}  ${a.rule}  ${a.reason}`)
if (findings.length > 0) process.exit(1)
