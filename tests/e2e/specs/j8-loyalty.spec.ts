/**
 * J8 «Хочу выгоду»: заказываю регулярно — вижу выгоду и прогресс.
 * Сценарий: Профиль → уровень, прогресс-кольцо → колесо фортуны после заказа → достижения.
 * PLACEHOLDER: profile, wheel and loyalty screens are stubs — keep `test.fixme` until `TID.profile.planned` /
 * `TID.wheel.planned` ids exist. The wheel CTA after delivery (`order-primary-cta`) is already asserted in J4.
 */
import { test, expect, TID, expectUx, expectScreen } from '../support/fixtures';

test.describe('J8 · Хочу выгоду', () => {
  test.fixme('profile shows level, progress ring and achievements', async ({ app, page }) => {
    await app.open({ loggedIn: true });
    await app.goTab('profile');
    await app.profile.expectOpen();
    // Level title is one of the loyalty levels; ring shows "до «…» N ₽".
    await expect(app.tid(TID.profile.planned.level)).toHaveText(/Искра|Пламя|Жар|Пекло/);
    await expect(app.tid(TID.profile.planned.progressRing)).toBeVisible();
    await expect(app.tid(TID.profile.planned.points)).toContainText(/\d/);
    await expect(app.tid(TID.profile.planned.achievements)).toBeVisible();
    await expectUx(page, 'profile');
    await expectScreen(page, 'j8-profile');
  });

  test.fixme('wheel of fortune after a delivered order → prize credited', async ({ app, page }) => {
    test.setTimeout(120_000);
    await app.open({ loggedIn: true, speed: 60 });
    await app.placeOrder();
    // After delivery the order screen offers «Крутить колесо призов» (one spin per completed order).
    await app.expectStatus(/Доставлен/, 90_000);
    await app.tap(TID.order.primaryCta);
    await app.wheel.expectOpen();
    await expectUx(page, 'wheel');
    await app.tap(TID.wheel.planned.primaryCta);
    await expect(app.tid(TID.wheel.planned.result)).toBeVisible({ timeout: 10_000 });
    await expect(app.wheel.primaryCta).toBeHidden(); // no second spin
  });
});
