export const SOURCE_EXTENSIONS = ['ts', 'tsx'] as const
export const SCAN_ROOTS = ['apps', 'packages', 'modules', 'providers', 'scripts', 'test'] as const

/** Test code, fixtures, generated code and constants files are not checked for literals (§10.1.7). */
export const LITERAL_EXCLUDED_GLOBS = [
  '**/test/**',
  '**/e2e/**',
  '**/testing/**',
  '**/*.test.*',
  '**/fixtures/**',
  '**/generated/**',
  'packages/ui/src/vendor/**',
  '**/*.d.ts',
  '**/constants.ts',
  '**/constants/**',
  '**/testids.ts',
] as const

export const I18N_KEY_LITERAL = /^[a-z][a-z0-9-]*:[A-Za-z0-9_.-]+$/
export const UPPER_SNAKE = /^[A-Z][A-Z0-9_]*$/
export const CLASS_HELPERS = ['cn', 'cva', 'clsx', 'twMerge'] as const
export const ALLOWED_NUMBERS = ['0', '1', '-1'] as const
export const LITERALS_RULE = 'literals'
export const GITIGNORE = '.gitignore'
export const UTF8 = 'utf8'

/** ESTree node type names used by the AST checks. */
export const NODE = {
  Program: 'Program',
  Literal: 'Literal',
  TemplateLiteral: 'TemplateLiteral',
  Identifier: 'Identifier',
  UnaryExpression: 'UnaryExpression',
  BinaryExpression: 'BinaryExpression',
  CallExpression: 'CallExpression',
  ExpressionStatement: 'ExpressionStatement',
  ExportNamedDeclaration: 'ExportNamedDeclaration',
  VariableDeclarator: 'VariableDeclarator',
  JSXAttribute: 'JSXAttribute',
  TSPropertySignature: 'TSPropertySignature',
} as const
