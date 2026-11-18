import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { uniformen } from './vite/uniformen-plugin'

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), uniformen()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
