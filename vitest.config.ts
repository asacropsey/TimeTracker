import { defineConfig } from 'vitest/config';

// Tests run without a browser. IndexedDB is simulated by "fake-indexeddb".
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
