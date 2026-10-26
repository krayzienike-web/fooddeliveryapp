/**
 * Runtime flags. On web, e2e tests inject `window.__ZHAR_E2E__` before the bundle loads.
 * Read once at startup.
 */
export interface E2EFlags {
  seed?: number;
  speed?: number;
  skipOnboarding?: boolean;
  loggedIn?: boolean;
  reducedMotion?: boolean;
  persist?: boolean;
  /** Cheap 3D for tests: half resolution, no shadows, no environment map (software GL in CI). */
  lowGl?: boolean;
}

declare const globalThis: { __ZHAR_E2E__?: E2EFlags };

export const E2E: E2EFlags = (typeof globalThis !== 'undefined' && globalThis.__ZHAR_E2E__) || {};

export const IS_E2E = Object.keys(E2E).length > 0;

export const TEST_SMS_CODE = '0000';

export const CITY = 'Санкт-Петербург';
