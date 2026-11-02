/** Entry of the root `pnpm package:mac|linux|win|all` scripts (00, §10.2); same CLI as `cli.ts`. */
import { runMain } from './cli.ts'
import { ARGV_USER_START } from './constants.ts'

await runMain(process.argv.slice(ARGV_USER_START))
