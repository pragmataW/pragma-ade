import type { BrowserWindow } from 'electron'
import { dialog } from 'electron'
import { net } from 'electron'

export const used: [typeof dialog, typeof net, BrowserWindow | undefined] = [dialog, net, undefined]
