/**
 * J7 «Что-то пошло не так»: заказ опаздывает — решить за 30 секунд и получить компенсацию без споров.
 * Сценарий: Инцидент (панель режиссёра) → проактивное сообщение → выбор решения → баллы начислены.
 * Rule: ≤ 2 proactive messages per order (payment problems excepted).
 */
import { test, expect, TID, expectGoodUx, expectScreen } from '../support/fixtures';

async function placeOrder(app: import('../support/app').App) {
  await app.open({ loggedIn: true, speed: 1 });
  await app.page.locator('[data-testid^="home-dish-add-"]').first().click();
  await app.openCart();
  await app.checkoutAndPay();
}

test.describe('J7 · Что-то пошло не так', () => {
  test.fixme('kitchen delay → proactive card → «Подожду» → points credited', async ({ app, page }) => {
    await placeOrder(app);
    const pointsBefore = await (async () => { await app.goTab('profile'); return Number((await app.tid(TID.profile.points).innerText()).replace(/[^\d]/g, '')); })();

    // 1. Director panel → «Кухня задерживается».
    await app.openDirector();
    await app.tap(TID.director.incident('kitchen_delay'));
    await app.tap(TID.director.close);

    // 2. Proactive message appears on the order screen (and capsule) with resolutions + compensation.
    await app.tap(TID.global.orderCapsule);
    const card = app.tid(TID.order.incident);
    await expect(card).toBeVisible();
    await expect(card).toContainText('Кухня задерживается');
    await expectGoodUx(page, { screen: 'order-incident' });
    await expectScreen(page, 'j7-incident-card');

    // 3. Choose «Подожду» → card resolves, compensation shown, points increased.
    await app.tap(TID.order.incidentResolution('wait'));
    await expect(card).toBeHidden();
    await app.goTab('profile');
    const pointsAfter = Number((await app.tid(TID.profile.points).innerText()).replace(/[^\d]/g, ''));
    expect(pointsAfter).toBeGreaterThan(pointsBefore);
  });

  test.fixme('stop-list → replacement offered → «Заменить»', async ({ app }) => {
    await placeOrder(app);
    await app.openDirector();
    await app.tap(TID.director.incident('stop_list'));
    await app.tap(TID.director.close);
    await app.tap(TID.global.orderCapsule);
    await expect(app.tid(TID.order.incident)).toContainText('закончилось');
    await app.tap(TID.order.incidentResolution('replace'));
    await expect(app.tid(TID.order.incident)).toBeHidden();
  });

  test.fixme('frequency cap: third proactive message is not shown', async ({ app, page }) => {
    await placeOrder(app);
    await app.openDirector();
    for (const k of ['stop_list', 'kitchen_delay', 'weather_load'] as const) await app.tap(TID.director.incident(k));
    await app.tap(TID.director.close);
    await app.tap(TID.global.orderCapsule);
    await expect(page.getByText('Сейчас ливень')).toBeHidden();
  });
});
