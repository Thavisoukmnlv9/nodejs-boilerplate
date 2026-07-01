// CommonJS config (avoids needing ts-node just to read the config file).
// ts-jest still compiles the tests; path aliases mirror tsconfig `paths`.

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
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
