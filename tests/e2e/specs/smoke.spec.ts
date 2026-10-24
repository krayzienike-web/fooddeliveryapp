/** Always-on smoke: the web export boots on a Pixel 7 viewport without errors or horizontal overflow. */
import { test, expect, collectUxViolations } from '../support/fixtures';

test('web export boots without errors', async ({ app, page }) => {
  await app.open();
  await expect(page.locator('#root')).not.toBeEmpty();
  await app.expectNoErrors();
});

test('first screen has no horizontal overflow at 412 px', async ({ app, page }) => {
  await app.open();
  expect(page.viewportSize()?.width).toBe(412);
  expect(await collectUxViolations(page, { checks: ['overflow'] })).toEqual([]);
});
