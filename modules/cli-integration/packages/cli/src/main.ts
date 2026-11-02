import type { CliMethod } from '@pragma/module-cli-integration/contract'
import { COMMAND_KIND, helpText, type ParsedCommand, parseCli } from './args'
import { type CallOptions, callBridge } from './client'
import { buildRequest, type RequestIo } from './commands'
import { type BridgeEndpoint, resolveBridgeEndpoint } from './connection'
import { NEWLINE } from './constants'
import { formatError, formatResult } from './output'

export interface CliIo extends RequestIo {
  platform: NodeJS.Platform
  home: string
  stdout(s: string): void
  stderr(s: string): void
}

/** Injected so tests can stub the transport and the bundle can inject its version. */
export interface CliDeps {
  version: string
  resolve(env: NodeJS.ProcessEnv, o: { home: string; platform: NodeJS.Platform }): Promise<BridgeEndpoint>
  call(ep: BridgeEndpoint, method: CliMethod, payload: unknown, o?: CallOptions): Promise<unknown>
}

const JSON_FLAG = '--json'

export const defaultDeps = (version: string): CliDeps => ({
  version,
  resolve: resolveBridgeEndpoint,
  call: callBridge,
})

async function execute(cmd: ParsedCommand, io: CliIo, deps: CliDeps): Promise<void> {
  switch (cmd.kind) {
    case COMMAND_KIND.help:
      return io.stdout(helpText(cmd.topic))
    case COMMAND_KIND.version:
      return io.stdout(`${deps.version}${NEWLINE}`)
    case COMMAND_KIND.call: {
      const { method, payload } = await buildRequest(cmd, io)
      const endpoint = await deps.resolve(io.env, { home: io.home, platform: io.platform })
      const result = await deps.call(endpoint, method, payload)
      return io.stdout(formatResult(method, result, cmd.json))
    }
    default: {
      const never: never = cmd
      throw new Error(`unhandled command ${JSON.stringify(never)}`)
    }
  }
}

/** Runs one `pragma …` invocation and returns its exit code; never throws. */
export async function run(argv: string[], io: CliIo, deps: CliDeps): Promise<number> {
  try {
    await execute(parseCli(argv), io, deps)
    return 0
  } catch (e) {
    const out = formatError(e, argv.includes(JSON_FLAG))
    io[out.stream](out.text)
    return out.exitCode
  }
}
