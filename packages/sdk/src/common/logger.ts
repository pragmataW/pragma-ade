export type LogFn = (message: string, ...details: unknown[]) => void

export interface Logger {
  debug: LogFn
  info: LogFn
  warn: LogFn
  error: LogFn
  child(scope: string): Logger
}
