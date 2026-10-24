/**
 * J8 «Хочу выгоду»: заказываю регулярно — вижу выгоду и прогресс.
 * Сценарий: Профиль → уровень, прогресс-кольцо → колесо фортуны после заказа → достижения.
 */
import { test, expect, TID, expectGoodUx, expectScreen } from '../support/fixtures';

test.describe('J8 · Хочу выгоду', () => {
  test.fixme('profile shows level, progress ring and achievements', async ({ app, page }) => {
    await app.open({ loggedIn: true });
    await app.goTab('profile');
    await app.profile.expectOpen();
    // Level title is one of the loyalty levels; ring shows "до «…» N ₽".
    await expect(app.tid(TID.profile.level)).toHaveText(/Искра|Пламя|Жар|Пекло/);
    await expect(app.tid(TID.profile.progressRing)).toBeVisible();
    await expect(app.tid(TID.profile.points)).toContainText(/\d/);
    await expect(app.tid(TID.profile.achievements)).toBeVisible();
    await expectGoodUx(page, { screen: 'profile' });
    await expectScreen(page, 'j8-profile');
  });

  test.fixme('wheel of fortune after a delivered order → prize credited', async ({ app, page }) => {
    test.setTimeout(120_000);
    await app.open({ loggedIn: true, speed: 60 });
    await page.locator('[data-testid^="home-dish-add-"]').first().click();
    await app.openCart();
    await app.checkoutAndPay();
    // After «Доставлено» the wheel is offered (one spin per completed order).
    await expect(app.tid(TID.order.statusTitle)).toHaveText('Доставлено', { timeout: 90_000 });
    await app.wheel.expectOpen();
    await expectGoodUx(page, { screen: 'wheel' });
    await app.tap(TID.wheel.primaryCta);
    await expect(app.tid(TID.wheel.result)).toBeVisible({ timeout: 10_000 });
    await expect(app.wheel.primaryCta).toBeHidden(); // no second spin
  });
});
