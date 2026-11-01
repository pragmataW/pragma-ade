import { readFileSync } from 'node:fs'

export const third = readFileSync('settings.json')
export const First = () => <div className="flex gap-2" data-testid="pane-x" />
export const Second = () => <div className="flex gap-2" data-testid="pane-x" />
