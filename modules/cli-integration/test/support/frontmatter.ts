const FENCE = '---'
const KEY_RE = /^([a-z]+):\s*(.*)$/
const FOLDED = '>-'

/** Minimal YAML frontmatter reader: `key: value` and folded `key: >-` blocks (all SKILL.md files use). */
export function parseFrontmatter(text: string): { data: Record<string, string>; body: string } {
  const lines = text.split('\n')
  if (lines[0] !== FENCE) throw new Error('no frontmatter')
  const end = lines.indexOf(FENCE, 1)
  if (end < 0) throw new Error('unterminated frontmatter')
  const data: Record<string, string> = {}
  let folding: string | null = null
  for (const line of lines.slice(1, end)) {
    const m = KEY_RE.exec(line)
    if (m && !line.startsWith(' ')) {
      const [, key = '', value = ''] = m
      folding = value === FOLDED ? key : null
      data[key] = value === FOLDED ? '' : value
    } else if (folding) data[folding] = `${data[folding]} ${line.trim()}`.trim()
  }
  return { data, body: lines.slice(end + 1).join('\n') }
}
