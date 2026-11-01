import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { LogFn, Logger } from '../../common/logger'

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const
export type LogLevel = (typeof LOG_LEVELS)[number]

export interface LogSink {
  write(level: LogLevel, scope: string, message: string, details: unknown[]): void
}

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

const consoleSink: LogSink = {
  write(level, scope, message, details) {
    const prefix = scope ? `[${scope}] ` : ''
    console[level](`${prefix}${message}`, ...details)
  },
}

export function loggerFromSinks(sinks: readonly LogSink[], scope = ''): Logger {
  const at =
    (level: LogLevel): LogFn =>
    (message, ...details) => {
      for (const sink of sinks) sink.write(level, scope, message, details)
    }
  return {
    debug: at('debug'),
    info: at('info'),
    warn: at('warn'),
    error: at('error'),
    child: (child) => loggerFromSinks(sinks, scope ? `${scope}:${child}` : child),
  }
}

export function createLogger(opts: { file?: string; console?: boolean } = {}): Logger {
  const sinks: LogSink[] = []
  if (opts.file) sinks.push(fileSink(opts.file))
  if (opts.console ?? true) sinks.push(consoleSink)
  return loggerFromSinks(sinks)
}
