import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Logger } from '../../common/logger'
import { consoleSink, type LogLevel, type LogSink, loggerFromSinks } from '../shared/log-sinks'

export { LOG_LEVELS, type LogLevel, type LogSink, loggerFromSinks } from '../shared/log-sinks'

const formatDetail = (d: unknown): string => {
  if (d instanceof Error) return d.stack ?? d.message
  return typeof d === 'string' ? d : JSON.stringify(d)
}

export const formatLogLine = (level: LogLevel, scope: string, message: string, details: unknown[]): string =>
  [new Date().toISOString(), level.toUpperCase(), scope ? `[${scope}]` : '', message, ...details.map(formatDetail)]
    .filter(Boolean)
    .join(' ')

function fileSink(file: string): LogSink {
  mkdirSync(dirname(file), { recursive: true })
  return {
    write: (level, scope, message, details) =>
      appendFileSync(file, `${formatLogLine(level, scope, message, details)}\n`),
  }
}

export function createLogger(opts: { file?: string; console?: boolean } = {}): Logger {
  const sinks: LogSink[] = []
  if (opts.file) sinks.push(fileSink(opts.file))
  if (opts.console ?? true) sinks.push(consoleSink)
  return loggerFromSinks(sinks)
}
