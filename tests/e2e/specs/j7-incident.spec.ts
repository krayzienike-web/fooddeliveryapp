/**
 * J7 «Что-то пошло не так»: заказ опаздывает — решить за 30 секунд и получить компенсацию без споров.
 * Сценарий: Инцидент (панель режиссёра) → проактивное сообщение → выбор решения → баллы начислены.
 * Rule: ≤ 2 proactive messages per order (payment problems excepted).
 * Director panel: triple tap on the Home logo (`home-logo`); firing an incident closes the panel.
 */
import { test, expect, TID, expectUx, type App } from '../support/fixtures';

const num = (s: string) => Number(s.replace(/\D/g, ''));

/** Places an order at ×1 speed (stays in «принят/готовим» for the whole test), reading the points balance at checkout. */
async function orderAndGoHome(app: App): Promise<number> {
  await app.open({ loggedIn: true, speed: 1 });
  await app.addFromFeed();
  await app.openCart();
  await app.tap(TID.cart.primaryCta);
  const points = num((await app.tid(TID.checkout.points).innerText()).match(/на счёте ([\d\s]+)/)![1]);
  await app.tap(TID.checkout.primaryCta);
  await app.order.expectOpen();
  await expect(app.page.getByText('Заказ принят!')).toBeHidden({ timeout: 5_000 });
  await app.tap(TID.order.back);
  await app.home.expectOpen();
  return points;
}

async function openIncident(app: App, kind: string) {
  await app.triggerIncident(kind);
  await expect(app.tid(TID.director.panel)).toBeHidden();
  await app.tap(TID.global.orderCapsule);
  await app.order.expectOpen();
  return app.tid(TID.order.incident).first();
}

test.describe('J7 · Что-то пошло не так', () => {
  test('kitchen delay → proactive card with points already credited → «Подожду» → balance grew', async ({ app, page }) => {
    const before = await orderAndGoHome(app);

    const card = await openIncident(app, 'kitchen_delay');
    await expect(card).toContainText('Кухня задерживается');
    await expect(card).toContainText(/\+150\s*Б уже на счёте/);
    await expect(app.tid(TID.order.incidentResolution('cancel'))).toBeVisible();
    await expectUx(page, 'order');

    await app.tap(TID.order.incidentResolution('wait'));
    await expect(card).toContainText('Решено · Подожду');
    await expect(app.tid(TID.order.incidentResolution('wait'))).toHaveCount(0);

    // Balance seen at the next checkout includes the compensation.
    await app.tap(TID.order.back);
    await app.addFromFeed(1);
    await app.openCart();
    await app.tap(TID.cart.primaryCta);
    await expect.poll(async () => num((await app.tid(TID.checkout.points).innerText()).match(/на счёте ([\d\s]+)/)![1])).toBe(before + 150);
    await app.expectNoErrors();
  });

  test('stop-list → replacement offered → «Заменить»', async ({ app }) => {
    await orderAndGoHome(app);
    const card = await openIncident(app, 'stop_list');
    await expect(card).toContainText(/закончил/i);
    await app.tap(TID.order.incidentResolution('replace'));
    await app.expectToast('Заменили — за наш счёт');
    await expect(card).toContainText('Решено · Заменить');
  });

  test('«Отменить без штрафа» cancels the order', async ({ app }) => {
    await orderAndGoHome(app);
    await openIncident(app, 'kitchen_delay');
    await app.tap(TID.order.incidentResolution('cancel'));
    await app.expectToast('Заказ отменён');
    await app.expectStatus(/Отмен/);
  });

  test('frequency cap: a third proactive message is refused', async ({ app }) => {
    await orderAndGoHome(app);
    for (const k of ['stop_list', 'kitchen_delay']) {
      await app.triggerIncident(k);
      await expect(app.tid(TID.director.panel)).toBeHidden();
    }
    await app.triggerIncident('cold_risk');
    await app.expectToast('Лимит: не больше 2 проактивных сообщений на заказ');
    await app.closeDirector();
    await app.tap(TID.global.orderCapsule);
    await expect(app.tid(TID.order.incident)).toHaveCount(2);
  });

  test('payment failure is exempt from the cap and offers СБП', async ({ app }) => {
    await orderAndGoHome(app);
    for (const k of ['stop_list', 'kitchen_delay']) {
      await app.triggerIncident(k);
      await expect(app.tid(TID.director.panel)).toBeHidden();
    }
    const card = await openIncident(app, 'payment_failed');
    await expect(card).toBeVisible();
    await expect(app.tid(TID.order.incidentResolution('sbp'))).toBeVisible();
    await expect(app.tid(TID.order.incident)).toHaveCount(3);
  });

  test('without an active order the panel explains what to do', async ({ app }) => {
    await app.open({ loggedIn: true });
    await app.triggerIncident('kitchen_delay');
    await app.expectToast('Сначала оформите заказ');
  });
});
