/**
 * Contract-test harness for the mock backend.
 *
 * The lead exports `createApi()` from `src/services/mock/index.ts`. Until that file exists every
 * contract suite is registered with `describe.skip`, so `npm test` stays green and the suites
 * light up automatically once the module lands.
 *
 * Expected factory shape (all options optional, extra keys are ignored by implementations that do not need them):
 *   createApi(opts?: { latencyMs?: number; seed?: number }): Api
 * Each test file should create a FRESH api (beforeEach/beforeAll) and call `director.reset()` for isolation.
 */
import fs from 'fs';
import path from 'path';
import type { Api, ApiError } from '@/services/contracts';

const MOCK_DIR = path.resolve(__dirname, '../../src/services/mock');
export const hasMockApi = ['index.ts', 'index.tsx', 'index.js'].some((f) => fs.existsSync(path.join(MOCK_DIR, f)));

/** `describe` when the mock backend exists, `describe.skip` otherwise. */
export const describeContract: jest.Describe = hasMockApi ? describe : describe.skip;

export function makeApi(): Api {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@/services/mock') as { createApi?: (opts?: Record<string, unknown>) => Api };
  if (typeof mod.createApi !== 'function') throw new Error('src/services/mock/index.ts must export createApi(): Api');
  return mod.createApi({ latencyMs: 0, seed: 1 });
}

export const TEST_PHONE = '+79990000000';
export const TEST_CODE = '0000';
/** Nevsky prospect, 28 — must be inside the delivery zone. */
export const SPB_CENTER = { lat: 59.9356, lng: 30.3256 };

/** Asserts that a promise rejects with an ApiError (optionally of a given code). */
export async function expectApiError(p: Promise<unknown>, code?: ApiError['code']): Promise<ApiError> {
  let err: unknown;
  try {
    await p;
  } catch (e) {
    err = e;
  }
  expect(err).toBeDefined();
  const e = err as ApiError;
  expect(typeof e.message).toBe('string');
  if (code) expect(e.code).toBe(code);
  return e;
}

/** Polls `fn` until it returns truthy or the timeout elapses (real timers). */
export async function waitFor<T>(fn: () => Promise<T | undefined | null | false> | T | undefined | null | false, timeoutMs = 20000, stepMs = 50): Promise<T> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v as T;
    if (Date.now() > until) throw new Error(`waitFor: condition not met in ${timeoutMs} ms`);
    await new Promise((r) => setTimeout(r, stepMs));
  }
}
