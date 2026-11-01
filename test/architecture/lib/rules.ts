import { discoverModules } from '../../../scripts/lib/discover.ts'
import { collectFiles } from './files.ts'
import { buildLocaleIndex } from './locale-index.ts'
import type { Violation } from './report.ts'
import { checkElectronImports } from './rules/electron-imports.ts'
import { checkI18nKeys } from './rules/i18n-keys.ts'
import { checkJsxText } from './rules/jsx-text.ts'
import { checkModuleBoundaries } from './rules/module-boundaries.ts'
import { checkProviderBranching } from './rules/provider-branching.ts'

const providerIds = (root: string): string[] =>
  discoverModules({ repoRoot: root })
    .filter((m) => m.manifest.kind === 'provider')
    .map((m) => m.id)

export const RULES = {
  'provider-branching': (root: string) => checkProviderBranching(collectFiles(root), providerIds(root)),
  'jsx-text': (root: string) => checkJsxText(collectFiles(root)),
  'module-boundaries': (root: string) => checkModuleBoundaries(collectFiles(root)),
  'electron-imports': (root: string) => checkElectronImports(collectFiles(root)),
  'i18n-keys': (root: string) => checkI18nKeys(collectFiles(root), buildLocaleIndex(root), root),
} as const satisfies Record<string, (root: string) => Violation[]>

export type RuleName = keyof typeof RULES

export const runRule = (rule: RuleName, root: string): Violation[] => RULES[rule](root)
