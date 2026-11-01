/** Playwright helpers for the board's and other modules' (phase 10) E2E tests (`@pragma/module-board/testing`). */
import { expect, type Locator, type Page } from '@playwright/test'
import { dragTo, settleAnimations } from '@pragma/test-support/e2e'
import { BOARD_TESTID_ATTRS as A, BOARD_TESTIDS as T } from '../src/contract'

const byTestId = (id: string): string => `[data-testid="${id}"]`
const WAIT_MS = 10_000
const RETRY_MS = 1000
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
    // A new drag cannot start while the previous drop animation runs.
    await settleAnimations(this.page)
    await dragTo(this.page, this.card(title), target, { steps: DRAG_STEPS })
  }

  /** Waits until the drag hovers `column` (`data-drop-target`). */
  async expectDropTarget(column: string): Promise<void> {
    await expect(this.column(column)).toHaveAttribute(A.dropTarget, 'true', { timeout: WAIT_MS })
  }

  /**
   * During a keyboard drag, presses `key` until the drag hovers `column` (the first press can land before dnd-kit
   * measured the drop targets).
   */
  async keyboardMoveTo(key: string, column: string): Promise<void> {
    await expect(async () => {
      await this.page.keyboard.press(key)
      await expect(this.column(column)).toHaveAttribute(A.dropTarget, 'true', { timeout: RETRY_MS })
    }).toPass({ timeout: WAIT_MS })
  }

  /** Drags a column by its handle onto the column now at `toIndex` (its menu button, the visible right edge). */
  async dragColumn(name: string, toIndex: number): Promise<void> {
    const source = this.column(name).getByTestId(T.columnHandle)
    await settleAnimations(this.page)
    await source.scrollIntoViewIfNeeded()
    const target = this.page.getByTestId(T.column).nth(toIndex).getByTestId(T.columnMenu)
    await dragTo(this.page, source, target, { steps: DRAG_STEPS })
  }
}
