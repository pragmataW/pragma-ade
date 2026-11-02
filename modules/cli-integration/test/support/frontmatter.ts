const FENCE = '---'
const KEY_RE = /^([a-z]+):\s*(.*)$/
const FOLDED = '>-'

/** Folds `key: value` lines and indented continuation lines into one `key → value` map. */
function foldEntries(lines: string[]): Record<string, string> {
  const data: Record<string, string> = {}
  let current: string | null = null
  for (const line of lines) {
    const m = line.startsWith(' ') ? null : KEY_RE.exec(line)
    if (m) {
      current = m[1] ?? ''
      data[current] = m[2] === FOLDED ? '' : (m[2] ?? '')
    } else if (current !== null) data[current] = `${data[current]} ${line.trim()}`.trim()
  }
  return data
}

/** Minimal YAML frontmatter reader: `key: value` and folded `key: >-` blocks (all SKILL.md files use). */
export function parseFrontmatter(text: string): { data: Record<string, string>; body: string } {
  const lines = text.split('\n')
  const end = lines[0] === FENCE ? lines.indexOf(FENCE, 1) : -1
  if (end < 0) throw new Error('no frontmatter')
  return { data: foldEntries(lines.slice(1, end)), body: lines.slice(end + 1).join('\n') }
}
