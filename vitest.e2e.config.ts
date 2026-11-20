import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/e2e/**/*.test.ts'],
    fileParallelism: false,
    hookTimeout: 90_000,
    testTimeout: 60_000,
  },
})
