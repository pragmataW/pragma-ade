#!/usr/bin/env node
// Fake `opencode` 2.x CLI for tests: `node bin.mjs [prefix…] serve [--stdio] [--hostname H] [--port P]` or `--version`.
import { main } from './server.mjs'

main(process.argv.slice(2))
