/**
 * C13 + A18 «Оценка и поддержка»: оценка в один тап (5★ → ИИ-фото-отзыв ×2 баллов; ≤3★ → «Решить проблему»),
 * поддержка: самообслуживание с автокомпенсацией за ≤ 3 тапа, человек — в один тап.
 */
import { test, expect, TID, expectUx, type App } from '../support/fixtures';

async function delivered(app: App) {
  await app.open({ loggedIn: true, speed: 40 });
  await app.placeOrder();
  await app.expectStatus(/Доставлен/, 45_000);
}

test.describe('C13 · Оценка', () => {
  test('5★ → AI photo review fills the text → send → +100 points', async ({ app, page }) => {
    test.setTimeout(90_000);
    await delivered(app);
    await app.tap(TID.order.rateStar(5));
    await app.rate.expectOpen();
    await expect(app.rate.root).toContainText('Что понравилось?');
    await expectUx(page, 'rate');
    await app.tap(TID.rate.aiPhoto);
    await expect(app.tid(TID.rate.text)).toHaveValue(/как всегда огонь/, { timeout: 5_000 });
    await app.tap(TID.rate.primaryCta);
    await app.expectToast('Спасибо! +100 баллов');
    await app.order.expectOpen();
    await app.expectNoErrors();
  });

  test('2★ → «Что пошло не так?» → «Решить проблему сейчас» → support', async ({ app }) => {
    test.setTimeout(90_000);
    await delivered(app);
    await app.tap(TID.order.rateStar(2));
    await expect(app.rate.root).toContainText('Что пошло не так?');
    await expect(app.tid(TID.rate.aiPhoto)).toHaveCount(0);
    await app.tap(TID.rate.solve);
    await app.support.expectOpen();
  });
});

test.describe('A18 · Поддержка', () => {
  test('missing item → tick it → refund in points (+20 %) right away', async ({ app, page }) => {
    await app.open({ loggedIn: true, speed: 1 });
    await app.placeOrder();
    await app.tap(TID.order.support);
    await app.support.expectOpen();
    await expect(app.support.root).toContainText(/Вижу ваш заказ №\d+/);
    await expectUx(page, 'support');
    await app.tap(TID.support.topic('missing'));
    const item = app.prefixed('support-item-', app.support.root).first();
    await item.click();
    await app.tap(TID.support.itemsNext);
    await app.tap(TID.support.refundPoints);
    await expect(app.support.root).toContainText(/Готово: \+[\d\s]+Б — это на 20% больше суммы/);
    await expect(app.support.root).toContainText('Спасибо, всё');
  });

  test('«Опоздание» → 150 points credited without an operator', async ({ app }) => {
    await app.open({ loggedIn: true, speed: 1 });
    await app.placeOrder();
    await app.tap(TID.order.help);
    await app.tap(TID.support.topic('late'));
    await expect(app.support.root).toContainText('Начислил 150 баллов');
  });

  test('«Позвать человека» → operator joins', async ({ app }) => {
    await app.open({ loggedIn: true, speed: 1 });
    await app.placeOrder();
    await app.tap(TID.order.support);
    await app.tap(TID.support.human);
    await expect(app.support.root).toContainText('Подключаю оператора');
    await expect(app.support.root).toContainText('Анна на связи', { timeout: 6_000 });
  });

  // BUG (SupportScreen.tsx): the composer row (input + send) is 477 px wide on a 412 px screen; «send» is off-screen.
  test.fail('composer fits the screen', async ({ app, page }) => {
    await app.open({ loggedIn: true, speed: 1 });
    await app.placeOrder();
    await app.tap(TID.order.support);
    await app.support.expectOpen();
    const box = (await app.tid(TID.support.send).boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  });
});
