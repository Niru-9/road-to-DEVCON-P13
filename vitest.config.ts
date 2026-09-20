import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/live/**'], // live round-trip is gated via test:live (TASK 3)
    environment: 'node',
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});