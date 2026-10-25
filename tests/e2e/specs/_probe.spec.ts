import { test, TID } from '../support/fixtures';
test('p', async ({ app, page }) => {
  await app.open({ loggedIn: true, speed: 1 });
  await app.placeOrder();
  await app.tap(TID.order.support);
  await app.support.expectOpen();
  await page.waitForTimeout(500);
  console.log(await page.evaluate(() => [...document.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > 413 && e.getBoundingClientRect().width > 0).slice(0, 8).map((e) => `${e.tagName} ${e.getAttribute('data-testid')} ${Math.round(e.getBoundingClientRect().left)}..${Math.round(e.getBoundingClientRect().right)} ${(e.textContent || '').slice(0, 30)}`).join('\n')));
  await page.screenshot({ path: '/tmp/claude-0/-home-user-fooddeliveryapp/a7576e4d-a22f-5075-afad-cd848d288939/scratchpad/support.png' });
});
