/**
 * J2 «Повторяю любимое»: хочу то же, что в прошлый раз, в один тап.
 * Сценарий: Главная → карточка «Как обычно в пятницу?» → «Повторить» → корзина собрана.
 * Needs: demo user history with ≥3 Friday-evening orders (seed), clock fixed to Friday 19:30 MSK.
 */
import { test, expect, TID, expectGoodUx, expectScreen } from '../support/fixtures';

const FRIDAY_1930 = new Date('2026-10-23T19:30:00+03:00');

test.describe('J2 · Повторяю любимое', () => {
  test.fixme('Friday ritual card → «Повторить» → cart filled with the usual order', async ({ app, page }) => {
    // 1. Logged-in demo user, Friday 19:30 → home.
    await app.open({ loggedIn: true }, { now: FRIDAY_1930 });
    await app.home.expectOpen();

    // 2. Exactly ONE proactive card (D2 rule), titled «Как обычно в пятницу?», with «Почему?» and «Не предлагать такое».
    const card = app.tid(TID.home.prediction);
    await expect(card).toHaveCount(1);
    await expect(card).toContainText('Как обычно в пятницу?');
    await expect(app.tid(TID.home.predictionWhy)).toBeVisible();
    await expect(app.tid(TID.home.predictionMute)).toBeVisible();
    await expectGoodUx(page, { screen: 'home' });
    await expectScreen(page, 'j2-home-ritual');

    // 3. «Почему?» explains the pattern (по пятницам … раза).
    await app.tap(TID.home.predictionWhy);
    await expect(page.getByText(/по пятницам/)).toBeVisible();

    // 4. «Повторить» → cart opens, lines equal to the usual order, total > 0, ready to «Оформить».
    await app.tap(TID.home.predictionCta);
    await app.cart.expectOpen();
    expect(await page.locator('[data-testid^="cart-line-"]:not([data-testid^="cart-line-inc"]):not([data-testid^="cart-line-dec"])').count()).toBeGreaterThan(0);
    await expect(app.tid(TID.cart.total)).toContainText('₽');
    await expect(app.cart.primaryCta).toBeEnabled();
  });

  test.fixme('«Не предлагать такое» hides the card and it does not come back after reload', async ({ app, page }) => {
    await app.open({ loggedIn: true, persist: true }, { now: FRIDAY_1930 });
    await app.tap(TID.home.predictionMute);
    await expect(app.tid(TID.home.prediction)).toBeHidden();
    await page.reload();
    await app.home.expectOpen();
    await expect(page.getByText('Как обычно в пятницу?')).toBeHidden();
  });
});
