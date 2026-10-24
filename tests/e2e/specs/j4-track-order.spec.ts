/**
 * J4 «Жду заказ»: после оплаты хочу видеть честный статус и курьера.
 * Сценарий: Оформление → живая кухня → курьер на карте → капсула статуса на любом экране.
 * Uses `speed` flag so the mock order goes through the whole lifecycle in ~30 s.
 */
import { test, expect, TID, expectGoodUx, expectScreen } from '../support/fixtures';

test.describe('J4 · Жду заказ', () => {
  test.fixme('pay → live kitchen → courier on map → status capsule everywhere → delivered', async ({ app, page }) => {
    test.setTimeout(120_000);
    await app.open({ loggedIn: true, speed: 60 });

    // 1. Add the first dish from the feed and pay.
    await page.locator('[data-testid^="home-dish-add-"]').first().click();
    await app.openCart();
    await app.checkoutAndPay();

    // 2. Order screen: status title, progress ring, live kitchen block with chef.
    await expect(app.tid(TID.order.progress)).toBeVisible();
    await expect(app.tid(TID.order.kitchen)).toBeVisible();
    await expect(app.tid(TID.order.chef)).toBeVisible();
    await expectGoodUx(page, { screen: 'order' });
    await expectScreen(page, 'j4-order-cooking');

    // 3. Navigate away → status capsule (Dynamic-Island style) is visible on other tabs and opens the order back.
    await app.goTab('menu');
    await expect(app.tid(TID.global.orderCapsule)).toBeVisible();
    await app.goTab('profile');
    await expect(app.tid(TID.global.orderCapsule)).toBeVisible();
    await app.tap(TID.global.orderCapsule);
    await app.order.expectOpen();

    // 4. Courier phase: map + courier card + ETA appear.
    await expect(app.tid(TID.order.statusTitle)).toHaveText(/Курьер/, { timeout: 60_000 });
    await expect(app.tid(TID.order.courierMap)).toBeVisible();
    await expect(app.tid(TID.order.courier)).toBeVisible();
    await expect(app.tid(TID.order.eta)).toContainText(/мин/);

    // 5. Delivered → rating stars appear; capsule disappears.
    await expect(app.tid(TID.order.statusTitle)).toHaveText('Доставлено', { timeout: 60_000 });
    await expect(app.tid(TID.order.rateStar(5))).toBeVisible();
    await expect(app.tid(TID.global.orderCapsule)).toBeHidden();
  });

  test.fixme('cancel is possible only before cooking', async ({ app, page }) => {
    await app.open({ loggedIn: true, speed: 1 });
    await page.locator('[data-testid^="home-dish-add-"]').first().click();
    await app.openCart();
    await app.checkoutAndPay();
    await expect(app.tid(TID.order.cancel)).toBeVisible();
    await app.tap(TID.order.cancel);
    await expect(app.tid(TID.order.statusTitle)).toHaveText('Отменён');
  });
});
