import { expect, it } from 'vitest'
import { classifyNavigation } from '../../src/main/navigation-policy'
import { partitionForWorktree } from '../../src/main/partition'

it.each([
  ['http://localhost:3000/', 'internal'],
  ['https://a.test/', 'internal'],
  ['about:blank', 'internal'],
  ['mailto:a@b.c', 'external'],
  ['zoommtg://join', 'external'],
  ['vscode://file/x', 'external'],
  ['file:///etc/passwd', 'blocked'],
  ['javascript:alert(1)', 'blocked'],
  ['data:text/html,x', 'blocked'],
  ['blob:http://x/1', 'blocked'],
  ['chrome://settings', 'blocked'],
  ['devtools://x', 'blocked'],
  ['view-source:http://x', 'blocked'],
  ['about:config', 'blocked'],
  ['not a url', 'blocked'],
])('%s is %s', (u, k) => expect(classifyNavigation(u)).toBe(k))

it.each([
  ['abc-1', 'persist:wt-abc-1'],
  ['a/b:c', 'persist:wt-a_b_c'],
])('partition %s', (id, p) => expect(partitionForWorktree(id)).toBe(p))
