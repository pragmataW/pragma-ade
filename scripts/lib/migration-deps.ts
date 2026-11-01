const TABLE_REFERENCE = /\b(?:ALTER\s+TABLE|REFERENCES)\s+["`[]?([A-Za-z_][A-Za-z0-9_]*)/gi

export interface MigrationOwnerInput {
  id: string
  dependsOn: readonly string[]
  migrations: { file: string; sql: string }[]
}

const tablePrefix = (id: string): string => `${id.replaceAll('-', '_')}_`

function ownerOf(table: string, ids: readonly string[]): string | undefined {
  return ids.filter((id) => table.startsWith(tablePrefix(id))).sort((a, b) => b.length - a.length)[0]
}

/** A migration that ALTERs or REFERENCES another module's table must depend on that module (§10.1.4). */
export function checkMigrationDeps(mods: readonly MigrationOwnerInput[]): string[] {
  const ids = mods.map((m) => m.id)
  const problems: string[] = []
  for (const mod of mods) {
    for (const { file, sql } of mod.migrations) {
      for (const match of sql.matchAll(TABLE_REFERENCE)) {
        const table = match[1] as string
        const owner = ownerOf(table, ids)
        if (owner === undefined || owner === mod.id || mod.dependsOn.includes(owner)) continue
        problems.push(`migration ${file} touches ${table} owned by ${owner} but ${mod.id} does not depend on it`)
      }
    }
  }
  return problems
}
