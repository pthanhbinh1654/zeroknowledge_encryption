import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    testTimeout: 30000, // 30 seconds for encryption tests
    hookTimeout: 30000,
    teardownTimeout: 30000,
    // Mock browser APIs
    deps: {
      inline: ['@noble/ciphers', '@noble/curves', '@noble/hashes', 'argon2-browser', 'jszip']
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  define: {
    global: 'globalThis',
  },
})
