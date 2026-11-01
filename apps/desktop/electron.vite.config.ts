import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import { nativeExternals } from './vite/native-externals'

const REPO_ROOT = resolve(import.meta.dirname, '../..')
const DEDUPE = ['react', 'react-dom', 'i18next', 'react-i18next', 'zod', 'zustand']

export default defineConfig({
  main: {
    plugins: [nativeExternals()],
    build: { externalizeDeps: true },
  },
  preload: {
    build: {
      externalizeDeps: false,
      rollupOptions: { output: { format: 'cjs', entryFileNames: 'index.cjs' } },
    },
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    resolve: { dedupe: DEDUPE },
    server: { fs: { allow: [REPO_ROOT] } },
  },
})
