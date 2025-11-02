import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: [
      './src/test/setup.ts',
      './src/test/config/vitest-setup.ts',
    ],
    globals: true,
    css: true,
    // Test execution configuration
    testTimeout: 30000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1,
      },
    },
    // Test file patterns
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'src/test/**/*.test.{js,ts,jsx,tsx}',
    ],
    exclude: [
      'node_modules/',
      'dist/',
      '.next/',
      'coverage/',
      '**/*.d.ts',
      '**/*.config.*',
      '**/e2e/**',
    ],
    // Advanced coverage configuration
    coverage: {
      provider: 'v8',
      reporter: [
        'text',
        'text-summary',
        'json',
        'json-summary',
        'html',
        'lcov',
        'clover',
        'cobertura',
      ],
      reportOnFailure: true,
      all: true,
      include: [
        'src/**/*.{js,ts,jsx,tsx}',
      ],
      exclude: [
        'node_modules/',
        'src/test/',
        'src/**/*.d.ts',
        'src/**/*.config.*',
        'src/**/*.stories.*',
        'src/**/index.ts',
        '**/coverage/**',
        '.next/',
        'drizzle/',
        'scripts/',
        'src/app/**/layout.tsx',
        'src/app/**/loading.tsx',
        'src/app/**/error.tsx',
        'src/app/**/not-found.tsx',
        'src/middleware.ts',
        'src/env.ts',
      ],
      // Enhanced coverage thresholds
      thresholds: {
        global: {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
        // Per-file thresholds for critical components
        'src/lib/services/': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        'src/lib/utils/validation.ts': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        'src/lib/error-handling/': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
      // Coverage watermarks for color coding
      watermarks: {
        statements: [70, 85],
        functions: [70, 85],
        branches: [70, 85],
        lines: [70, 85],
      },
    },
    // Custom reporters
    reporters: [
      'default',
      'verbose',
      'json',
      'junit',
      ['html', { outputFile: 'test-results/index.html' }],
    ],
    outputFile: {
      json: 'test-results/results.json',
      junit: 'test-results/junit.xml',
    },
    // Retry configuration
    retry: 2,
    // Watch mode configuration
    watch: false,
    // Environment variables for testing
    env: {
      NODE_ENV: 'test',
      VITEST: 'true',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@test': path.resolve(__dirname, './src/test'),
    },
  },
  // Define constants for testing
  define: {
    __TEST__: true,
    __DEV__: false,
  },
});