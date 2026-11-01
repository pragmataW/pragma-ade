import type { LogFn, Logger } from '../../common/logger'

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const
export type LogLevel = (typeof LOG_LEVELS)[number]

export interface LogSink {
  write(level: LogLevel, scope: string, message: string, details: unknown[]): void
}

export const consoleSink: LogSink = {
  write(level, scope, message, details) {
    const prefix = scope ? `[${scope}] ` : ''
    console[level](`${prefix}${message}`, ...details)
  },
}

/** A logger fanning out to sinks; `child(scope)` prefixes the scope (process-agnostic). */
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
