/** Fixture bodies a test tab can render (`fixture` of `registerRightTab`). */
export const TEST_TAB_FIXTURES = { text: 'text', sortable: 'sortable' } as const
export type TestTabFixture = (typeof TEST_TAB_FIXTURES)[keyof typeof TEST_TAB_FIXTURES]

/** Items of the `sortable` fixture, in their initial order. */
export const TEST_SORTABLE_ITEMS = ['A', 'B', 'C'] as const

export interface TestTabSpec {
  id: string
  titleKey: string
  order: number
  /** Default `text`: a body showing the translated title. */
  fixture?: TestTabFixture
}

/** `window.__pragmaTest`, installed by the shell renderer only in test mode. */
export interface PragmaTestApi {
  registerRightTab(t: TestTabSpec): void
  rightTabIds(): string[]
  execute(id: string, args?: unknown): Promise<unknown>
}

/** Cast `window` (or `globalThis`) to this inside `page.evaluate`. */
export type PragmaTestWindow = { __pragmaTest: PragmaTestApi }
