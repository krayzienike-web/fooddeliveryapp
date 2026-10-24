/**
 * Jest config for unit ("бэк"/domain) and contract tests.
 * Light setup: babel-jest + babel-preset-expo (resolved through `expo`, same preset Metro uses),
 * node environment, `@/` alias → ./src (mirrors tsconfig paths).
 * E2E (Playwright) specs live in tests/e2e and are NOT picked up by Jest.
 */
// Deterministic local time: predict.ts uses Date#getDay/getHours. Demo city = Saint Petersburg.
process.env.TZ = 'Europe/Moscow';

const presetExpo = require.resolve('babel-preset-expo', { paths: [require.resolve('expo/package.json')] });

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  testMatch: ['<rootDir>/tests/{unit,contract}/**/*.test.ts', '<rootDir>/src/**/__tests__/**/*.test.ts'],
  moduleNameMapper: { '\\.(mp4|webp|png|jpg|glb)$': '<rootDir>/tests/fixtures/assetStub.js', '^@/(.*)$': '<rootDir>/src/$1' },
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { presets: [presetExpo], babelrc: false, configFile: false }],
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/tests/e2e/'],
  clearMocks: true,
};
