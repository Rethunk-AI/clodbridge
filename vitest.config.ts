import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Match CLAUDE.md: gate reader layer only (CLI/tools/resources are thin MCP wiring).
      include: ['src/reader/**/*.ts'],
      exclude: [],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
