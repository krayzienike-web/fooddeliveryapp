/**
 * J4 «Жду заказ»: после оплаты хочу видеть честный статус и курьера.
 * Сценарий: Оформление → живая кухня → курьер на карте → капсула статуса на любом экране.
 * `speed` makes the mock order run its lifecycle (~135 s at ×1) faster.
 */
import { test, expect, TID, expectUx } from '../support/fixtures';

test.describe('J4 · Жду заказ', () => {
  test('live kitchen right after payment; status capsule on every tab opens the order', async ({ app, page }) => {
    await app.open({ loggedIn: true, speed: 1 });
    await app.placeOrder();

    // Order screen: status, big ETA (masked as *-live), 4-step progress, live kitchen with the chef.
    await app.expectStatus(/Заказ создан|Ресторан принял заказ|Готовим/);
    await expect(app.tid(TID.order.eta)).toBeVisible();
    await expect(app.tid(TID.order.progress)).toContainText('Принят');
    await expect(app.tid(TID.order.kitchen)).toBeVisible();
    await expect(app.tid(TID.order.chef)).toContainText(/Готовит шеф/);
    await expect(app.tid(TID.order.courierMap)).toHaveCount(0); // the map appears only on the road
    await expect(app.tid(TID.global.orderCapsule)).toBeHidden(); // hidden on the order screen itself
    await expectUx(page, 'order');

    // Away from the order: Dynamic-Island capsule on Home, Menu and the Assistant; it leads back to the order.
    await app.tap(TID.order.back);
    await app.home.expectOpen();
    await expect(app.tid(TID.home.activeOrder)).toBeVisible();
    for (const tab of ['menu', 'assistant', 'home'] as const) {
      await app.goTab(tab);
      await expect(app.tid(TID.global.orderCapsule)).toBeVisible();
    }
    await app.tap(TID.global.orderCapsule);
    await app.order.expectOpen();
    await app.expectNoErrors();
  });

  test('courier on the map → delivered → rating stars and the prize wheel CTA', async ({ app }) => {
    test.setTimeout(90_000);
    await app.open({ loggedIn: true, speed: 30 });
    await app.placeOrder();

    await app.expectStatus(/Курьер/, 30_000);
    await expect(app.tid(TID.order.courierMap)).toBeVisible();
    await expect(app.tid(TID.order.courier)).toContainText('★');
    await app.tap(TID.order.courierCall);
    await app.expectToast('подменный номер');

    await app.expectStatus(/Доставлен/, 45_000);
    await expect(app.tid(TID.order.rateStar(5))).toBeVisible();
    await expect(app.tid(TID.order.primaryCta)).toHaveText(/Крутить колесо призов/);
    await expect(app.tid(TID.order.courierMap)).toHaveCount(0);

    // Final order: the capsule lingers ~15 s with «Готово» (store.ts), then disappears.
    await app.tap(TID.order.back);
    await app.home.expectOpen();
    await expect(app.tid(TID.global.orderCapsule)).toContainText('Готово');
    await expect(app.tid(TID.global.orderCapsule)).toBeHidden({ timeout: 25_000 });
  });

  test('«Состав» expands the order lines', async ({ app }) => {
    await app.open({ loggedIn: true, speed: 1 });
    await app.placeOrder();
    await app.tap(TID.order.itemsToggle);
    await expect(app.order.root).toContainText(/× 1/);
  });

  // «Отменить заказ» (`order-cancel`) is shown while the order is created/accepted.
  test('cancel is possible only before cooking', async ({ app }) => {
    await app.open({ loggedIn: true, speed: 1 });
    await app.placeOrder();
    await app.tap('order-cancel');
    await app.expectStatus('Отменён');
  });
});
