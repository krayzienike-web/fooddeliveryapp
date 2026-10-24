/**
 * Shared Playwright fixtures. Specs import `test`/`expect` from here, not from @playwright/test:
 *
 *   import { test, expect, TID } from '../support/fixtures';
 *   test('…', async ({ app }) => { await app.open(); await app.tap(TID.home.search); });
 */
import { test as base, expect } from '@playwright/test';
import { App } from './app';

export const test = base.extend<{ app: App }>({
  app: async ({ page }, use) => {
    await use(new App(page));
  },
});

export { expect };
export { TID, kebab } from './testids';
export { expectGoodUx, collectUxViolations } from './ux';
export { expectScreen, settle } from './visual';
