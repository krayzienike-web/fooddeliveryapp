/**
 * Shared Playwright fixtures. Specs import `test`/`expect` from here, not from @playwright/test:
 *
 *   import { test, expect, TID } from '../support/fixtures';
 *   test('…', async ({ app }) => { await app.open(); await app.tap(TID.home.search); });
 */
import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { App } from './app';
import { KNOWN_UX, knownUxIgnore } from './known-issues';
import { collectUxViolations, type UxOptions } from './ux';

export const test = base.extend<{ app: App }>({
  app: async ({ page }, use) => {
    await use(new App(page));
  },
});

export { expect };
export { TID, kebab } from './testids';
export { expectGoodUx, collectUxViolations } from './ux';
export { KNOWN_UX, knownUxIgnore } from './known-issues';
export { FRIDAY_EVENING, SUNDAY_NOON, visible } from './app';
export type { App } from './app';

/** `expectGoodUx` scoped to `<screen>-screen`, minus the documented known debts of that screen (support/known-issues.ts). */
export async function expectUx(page: Page, screen: string, opts: UxOptions = {}): Promise<void> {
  const knownOverflow = (KNOWN_UX[screen] ?? []).some((k) => k.check === 'overflow');
  const v = (await collectUxViolations(page, { screen, ...opts, ignore: [...knownUxIgnore(screen), ...(opts.ignore ?? [])] }))
    // a known element overflow also makes the page itself scroll horizontally — that line has no element to ignore
    .filter((x) => !(knownOverflow && x.check === 'overflow' && x.testId === null));
  const msg = v.map((x) => `  [${x.check}] ${x.testId ?? '-'}: ${x.detail}`).join('\n');
  expect.soft(v, `UX heuristics on "${screen}":\n${msg}`).toEqual([]);
}
export { expectScreen, settle, waitForStill } from './visual';
