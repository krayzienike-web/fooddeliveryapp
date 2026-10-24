/**
 * J6 «Событие»: готовое банкетное предложение под гостей и бюджет.
 * Сценарий: Банкет: ползунки гостей/бюджета → ИИ-меню → отправить менеджеру.
 */
import { test, expect, TID, expectGoodUx } from '../support/fixtures';

test.describe('J6 · Событие', () => {
  test.fixme('sliders → AI menu within budget → send to manager', async ({ app, page }) => {
    await app.open({ loggedIn: true });
    // 1. Restaurants → restaurant with banquet hall → «Банкет».
    await app.goTab('restaurants');
    await page.locator('[data-testid^="restaurants-item-"]').first().click();
    await app.tap(TID.restaurant.banquet);
    await app.banquet.expectOpen();

    // 2. Guests slider → 20, budget slider → 3000 ₽/guest (sliders are role=slider; keyboard works on web).
    const guests = app.tid(TID.banquet.guests);
    await guests.focus();
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
    await app.tap(TID.banquet.format('banquet'));

    // 3. «Собрать меню» → AI menu items appear; total ≤ guests × budget.
    await app.tap(TID.banquet.generate);
    await expect(page.locator('[data-testid^="banquet-menu-item-"]').first()).toBeVisible({ timeout: 20_000 });
    await expect(app.tid(TID.banquet.total)).toContainText('₽');
    await expectGoodUx(page, { screen: 'banquet' });

    // 4. «Отправить менеджеру» → sent state.
    await app.tap(TID.banquet.primaryCta);
    await expect(app.tid(TID.banquet.sent)).toBeVisible();
  });
});
