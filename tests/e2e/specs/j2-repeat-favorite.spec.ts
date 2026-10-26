/**
 * J2 «Повторяю любимое»: Когда хочу то же, что в прошлый раз, я хочу повторить заказ в один тап.
 * Сценарий: Главная → карточка «Как обычно в пятницу?» → «Повторить» → корзина собрана.
 * The demo user has ≥ 3 Friday-evening orders; the clock is frozen-started at Friday 19:30 (Moscow).
 */
import { test, expect, TID, expectUx, FRIDAY_EVENING } from '../support/fixtures';

test.describe('J2 · Повторяю любимое', () => {
  test('Friday 19:30 → «Как обычно в пятницу?» → «Почему?» → «Повторить» → cart assembled', async ({ app, page }) => {
    await app.open({ loggedIn: true }, { now: FRIDAY_EVENING });
    await app.home.expectOpen();

    // D2: exactly one proactive suggestion on Home, with «Почему?».
    const card = app.tid(TID.home.prediction);
    await expect(card).toHaveCount(1);
    await expect(card).toContainText('Как обычно в пятницу?');
    await expectUx(page, 'home');

    await app.tap(TID.home.predictionWhy);
    await expect(card).toContainText(/Вы заказываете это по пятницам около 1?\d:00 — \d+ раз/);
    await expect(app.tid(TID.home.predictionMute)).toBeVisible();

    // «Повторить · N ₽» → cart with the same lines and the same total.
    const cta = app.tid(TID.home.predictionCta);
    await expect(cta).toContainText(/Повторить · [\d\s]+₽/);
    await cta.click();
    await app.cart.expectOpen();
    await app.expectToast('Собрали тот же заказ');
    expect(await app.cart.all('cart-line-').count()).toBeGreaterThanOrEqual(2);
    await app.expectNoErrors();
  });

  test('«Не предлагать такое» hides the suggestion', async ({ app }) => {
    await app.open({ loggedIn: true }, { now: FRIDAY_EVENING });
    await app.tap(TID.home.predictionWhy);
    await app.tap(TID.home.predictionMute);
    await app.expectToast('Больше не будем такое предлагать');
    await expect(app.page.getByText('Как обычно в пятницу?')).toBeHidden();
  });

  test('«Повторить» strip: one tap rebuilds a past order', async ({ app }) => {
    await app.open({ loggedIn: true }, { now: FRIDAY_EVENING });
    const repeat = app.prefixed('home-repeat-', app.home.root).first();
    await repeat.click();
    await app.expectToast('Корзина собрана как в прошлый раз');
    await expect(app.tid(TID.global.cartBar)).toBeVisible();
  });

  // FIXED (was: App.tsx → useOrders.load / mock orders.list): order history is loaded without a session, so a logged-out guest
  // sees the demo user's «Как обычно в пятницу?» and «Повторить» strip. Expected: no personal predictions before login.
  test('guest sees no personal suggestion', async ({ app }) => {
    await app.open({ loggedIn: false }, { now: FRIDAY_EVENING });
    await expect(app.page.getByText('Как обычно в пятницу?')).toBeHidden();
  });
});
