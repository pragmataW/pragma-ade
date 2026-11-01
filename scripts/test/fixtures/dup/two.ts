export function describe(items: { name: string; size: number; tags: string[] }[]): string {
  const total = items.reduce((sum, item) => sum + item.size, 0)
  const names = items.map((item) => item.name.trim().toLowerCase()).filter((name) => name.length > 0)
  const tags = new Set(items.flatMap((item) => item.tags))
  return `${names.join(', ')} (${total}) [${[...tags].sort().join(' ')}]`
}
