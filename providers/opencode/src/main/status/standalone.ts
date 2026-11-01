import { SERVER_FLAG, STANDALONE_FLAG } from './constants'

const isServerArg = (a: string): boolean => a === SERVER_FLAG || a.startsWith(`${SERVER_FLAG}=`)

/**
 * The plugin loads only in a private server: `--standalone` is appended (idempotent with 03's launch capability).
 * With `--server <url>` the session runs in someone else's server: not injectable (activity fallback).
 */
export function withStandalone(args: readonly string[]): { args: string[]; injectable: boolean } {
  if (args.some(isServerArg)) return { args: [...args], injectable: false }
  if (args.includes(STANDALONE_FLAG)) return { args: [...args], injectable: true }
  return { args: [...args, STANDALONE_FLAG], injectable: true }
}
