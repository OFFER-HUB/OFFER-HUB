/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['<rootDir>/tests/e2e/**/*.e2e.ts'],
    modulePaths: ['<rootDir>/apps/api/node_modules', '<rootDir>/node_modules'],
    moduleNameMapper: {
        '^@offerhub/shared(.*)$': '<rootDir>/packages/shared/src$1',
        '^@offerhub/database(.*)$': '<rootDir>/packages/database/src$1',
        '^@offerhub/sdk(.*)$': '<rootDir>/packages/sdk/src$1',
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json', diagnostics: false }],
        '^.+\\.js$': ['babel-jest', { presets: [['@babel/preset-env', { targets: { node: 'current' } }]] }],
    },
    transformIgnorePatterns: [
        'node_modules/(?!(nanoid|ky)/)',
    ],
    globalSetup: '<rootDir>/tests/e2e/global-setup.ts',
    globalTeardown: '<rootDir>/tests/e2e/global-teardown.ts',
    testTimeout: 30000,
    maxWorkers: 1,  // Run E2E tests sequentially
    verbose: true,
};
