/** Playwright helpers for the board's and other modules' (phase 10) E2E tests (`@pragma/module-board/testing`). */
import type { Locator, Page } from '@playwright/test'
import { dragTo } from '@pragma/test-support/e2e'
import { BOARD_TESTID_ATTRS as A, BOARD_TESTIDS as T } from '../src/contract'

const byTestId = (id: string): string => `[data-testid="${id}"]`
const WAIT_MS = 10_000
const DRAG_STEPS = 12
const ENTER = 'Enter'

/** Board page object built only on `BOARD_TESTIDS` / `BOARD_TESTID_ATTRS`. */
export class BoardPage {
  readonly page: Page
  constructor(page: Page) {
    this.page = page
  }

  get view(): Locator {
    return this.page.getByTestId(T.view)
  }

  /** Clicks the sidebar entry and waits for the board view. */
  async open(): Promise<void> {
    await this.page.getByTestId(T.sidebarEntry).click()
    await this.view.waitFor({ timeout: WAIT_MS })
  }

  /** A project name, or the "All projects" label. */
  async selectScope(name: string): Promise<void> {
    await this.page.getByTestId(T.scopePicker).click()
    await this.page.getByRole('option', { name, exact: true }).click()
  }

  column(name: string): Locator {
    return this.page.locator(`${byTestId(T.column)}[${A.columnName}="${name}"]`)
  }

  columnNames(): Promise<string[]> {
    return this.page
      .getByTestId(T.column)
      .evaluateAll((els, attr) => els.map((e) => e.getAttribute(attr) ?? ''), A.columnName)
  }

  card(title: string): Locator {
    return this.page
      .getByTestId(T.card)
      .filter({ has: this.page.getByTestId(T.cardTitle).getByText(title, { exact: true }) })
  }

  /** Card titles of a column in display order. */
  cardsIn(column: string): Promise<string[]> {
    return this.column(column).getByTestId(T.cardTitle).allTextContents()
  }

  /** Types a title into the column's quick add (choosing `project` in All projects) and presses Enter. */
  async quickAdd(column: string, title: string, project?: string): Promise<void> {
    const col = this.column(column)
    const input = col.getByTestId(T.quickAddInput)
    if (!(await input.isVisible())) await col.getByTestId(T.quickAdd).click()
    if (project) {
      await col.getByTestId(T.quickAddProject).click()
      await this.page.getByRole('option', { name: project, exact: true }).click()
    }
    await input.fill(title)
    await input.press(ENTER)
    await this.card(title).waitFor({ timeout: WAIT_MS })
  }

  async openCard(title: string): Promise<void> {
    await this.card(title).getByTestId(T.cardTitle).click()
    await this.page.getByTestId(T.drawer).waitFor({ timeout: WAIT_MS })
  }

  /** Drops the card on the card now at `toIndex` of `toColumn`, or on the column body when there is none. */
  async dragCard(title: string, toColumn: string, toIndex: number): Promise<void> {
    const col = this.column(toColumn)
    const cards = col.getByTestId(T.card)
    const target = toIndex < (await cards.count()) ? cards.nth(toIndex) : col.getByTestId(T.quickAdd)
    await dragTo(this.page, this.card(title), target, { steps: DRAG_STEPS })
  }

  /** Drags a column by its handle onto the column now at `toIndex`. */
  async dragColumn(name: string, toIndex: number): Promise<void> {
    const target = this.page.getByTestId(T.column).nth(toIndex).getByTestId(T.columnHandle)
    await dragTo(this.page, this.column(name).getByTestId(T.columnHandle), target, { steps: DRAG_STEPS })
  }
}
