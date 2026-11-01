/** What IPC and commands need from the picker (the PickerService implements it). */
export interface PickerControl {
  start(tabId: string): Promise<void>
  cancel(tabId: string): void
  dismiss(pickId: string): void
}
