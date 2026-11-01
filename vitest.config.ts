import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const ROOTS = '{apps,packages,modules,providers,scripts}'
const EXTENSION_PROOF = 'test/architecture/fixtures/extension-proof'
const EXCLUDE = ['**/node_modules/**', '**/fixtures/violations/**', 'scripts/test/fixtures/**', '**/out*/**']

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: [
            `${ROOTS}/**/test/**/*.test.ts`,
            'test/architecture/**/*.test.ts',
            `${EXTENSION_PROOF}/**/test/**/*.test.ts`,
          ],
          exclude: EXCLUDE,
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: [
            `${ROOTS}/**/test/**/*.test.tsx`,
            'test/architecture/**/*.test.tsx',
            `${EXTENSION_PROOF}/**/test/**/*.test.tsx`,
          ],
          exclude: EXCLUDE,
          setupFiles: ['packages/test-support/src/dom/setup.ts'],
        },
      },
    ],
  },
})
