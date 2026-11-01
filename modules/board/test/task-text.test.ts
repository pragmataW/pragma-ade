import { describe, expect, it } from 'vitest'
import { buildTaskPrompt, deriveBranchName, keyPrefixFor } from '../src/main/task-text'

describe('keyPrefixFor', () => {
  it.each([
    ['pragma-ade', 'PRA'],
    ['Çiçek', 'CIC'],
    ['—', 'TSK'],
    ['a-b', 'AB'],
  ])('%s → %s', (name, prefix) => expect(keyPrefixFor(name)).toBe(prefix))
})

describe('deriveBranchName', () => {
  it.each([
    ['Giriş ekranını düzelt', 'feat/pra-3-giris-ekranini-duzelt'],
    ['Fix login bug', 'feat/pra-3-fix-login-bug'],
    ['🚀', 'feat/pra-3'],
  ])('%s → %s', (title, branch) => expect(deriveBranchName('PRA-3', title)).toBe(branch))

  it('caps the slug at 40 chars on a hyphen boundary', () => {
    const branch = deriveBranchName('PRA-3', `${'a'.repeat(30)} ${'b'.repeat(30)}`)
    const slug = branch.slice('feat/pra-3-'.length)
    expect(slug.length).toBeLessThanOrEqual(40)
    expect(slug.endsWith('-')).toBe(false)
    expect(slug).toBe('a'.repeat(30))
  })

  it('keeps a single long word cut at 40 chars', () => {
    const slug = deriveBranchName('PRA-3', 'x'.repeat(60)).slice('feat/pra-3-'.length)
    expect(slug).toBe('x'.repeat(40))
  })
})

describe('buildTaskPrompt', () => {
  it.each([
    [{ title: ' T ', descriptionMd: '' }, 'T'],
    [{ title: 'T', descriptionMd: 'D\n' }, 'T\n\nD'],
  ])('%o → %j', (task, prompt) => expect(buildTaskPrompt(task)).toBe(prompt))
})
