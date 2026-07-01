// CommonJS config (avoids needing ts-node just to read the config file).
// The generated Prisma client is ESM-only (uses import.meta), so tests run
// under ts-jest's ESM preset (see package.json "test" script for the
// --experimental-vm-modules flag this requires).
const { createDefaultEsmPreset } = require('ts-jest');

/** @type {import('jest').Config} */
module.exports = {
  ...createDefaultEsmPreset({ tsconfig: 'tsconfig.json' }),
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // env.setup runs BEFORE modules load (so config/env validation sees test vars);
  // setup.ts runs after the framework is ready.
  setupFiles: ['<rootDir>/tests/env.setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  clearMocks: true,
  // External connections (Redis/BullMQ) can keep handles open; guarantee a clean exit.
  forceExit: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.types.ts',
    '!src/server.ts',
    '!src/worker.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageThreshold: {
    global: { branches: 40, functions: 45, lines: 45, statements: 45 },
  },
  testTimeout: 20000,
};
