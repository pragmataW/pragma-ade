import { expect, it } from 'vitest'
import type { ModuleManifest } from '../src/common/manifest'
import { resolveModuleGraph } from '../src/runtime/main/module-graph'
import { manifest } from './lib/builders'

type Row = [string, ModuleManifest[], string[], string[], [string, string][]]

it.each<Row>([
  [
    'dependencies come first',
    [manifest('b', { dependsOn: ['a'] }), manifest('a'), manifest('c')],
    [],
    ['a', 'b', 'c'],
    [],
  ],
  [
    'missing dependency',
    [manifest('a', { dependsOn: ['zz'] }), manifest('b')],
    [],
    ['b'],
    [['a', 'missing-dependency']],
  ],
  [
    'cycle',
    [manifest('a', { dependsOn: ['b'] }), manifest('b', { dependsOn: ['a'] }), manifest('c', { dependsOn: ['a'] })],
    [],
    [],
    [
      ['a', 'cycle'],
      ['b', 'cycle'],
      ['c', 'dependency-disabled'],
    ],
  ],
  [
    'user-disabled cascade',
    [manifest('a'), manifest('b', { dependsOn: ['a'] }), manifest('c')],
    ['a'],
    ['c'],
    [
      ['a', 'user'],
      ['b', 'dependency-disabled'],
    ],
  ],
  ['core ignores disable', [manifest('a', { core: true })], ['a'], ['a'], []],
  [
    'optional dependency affects order only',
    [manifest('a', { optionalDependsOn: ['b'] }), manifest('b'), manifest('c', { optionalDependsOn: ['zz'] })],
    [],
    ['b', 'a', 'c'],
    [],
  ],
  [
    'optional edge in a cycle does not exclude',
    [manifest('a', { optionalDependsOn: ['b'] }), manifest('b', { dependsOn: ['a'] })],
    [],
    ['a', 'b'],
    [],
  ],
])('%s', (_name, manifests, disabled, order, excluded) => {
  const graph = resolveModuleGraph(manifests, { disabled })
  expect(graph.order).toEqual(order)
  expect(graph.excluded.map((e) => [e.id, e.reason])).toEqual(excluded)
})
