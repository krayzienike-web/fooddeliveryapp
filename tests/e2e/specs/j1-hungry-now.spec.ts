/**
 * J1 «Голоден сейчас»: Когда я голоден и не знаю чего хочу, я хочу быстро увидеть аппетитные варианты под мой вкус.
 * Сценарий: Онбординг «Вкусовая ДНК» → главная с персональной подборкой → Reels → «В корзину» с видео → оформление.
 * Remove `.fixme` once the screens below expose the listed testIDs (see docs/testing.md).
 */
import { test, expect, TID, expectGoodUx, expectScreen } from '../support/fixtures';

test.describe('J1 · Голоден сейчас', () => {
  test.fixme('Taste DNA onboarding → personal feed → Reels → add to cart → checkout', async ({ app, page }) => {
    // 1. Fresh guest (no onboarding skipped, not logged in) opens the app → onboarding «Вкусовая ДНК».
    await app.open({ skipOnboarding: false });
    await app.onboarding.expectOpen();
    await expectGoodUx(page, { screen: 'onboarding' });
    await expectScreen(page, 'j1-onboarding');

    // 2. Pick 3 taste options (e.g. spicy, asian, seafood) — progress indicator advances; then «Готово».
    for (const opt of ['spicy', 'asian', 'seafood']) await app.tap(TID.onboarding.option(opt));
    await expect(app.tid(TID.onboarding.progress)).toBeVisible();
    await app.tap(TID.onboarding.primaryCta);

    // 3. Home shows the personal feed («Для вас»). First cards should match chosen taste — each has a «Почему?» chip.
    await app.home.expectOpen();
    const feed = app.tid(TID.home.forYouList);
    await expect(feed).toBeVisible();
    await expect(feed.locator('[data-testid^="home-dish-card-"]').first()).toBeVisible();
    await expect(page.locator('[data-testid^="home-dish-why-"]').first()).toBeVisible();
    // Guest browsing: no login wall on home.
    await expect(app.auth.root).toBeHidden();
    await expectGoodUx(page, { screen: 'home' });

    // 4. Open Reels from home, swipe/like, then «В корзину» straight from the video.
    await app.tap(TID.home.reelsEntry);
    await app.reels.expectOpen();
    await app.tap(TID.reels.like);
    await app.tap(TID.reels.primaryCta);
    await expect(app.tid(TID.global.cartBar)).toBeVisible();
    await expectGoodUx(page, { screen: 'reels' });
    await app.tap(TID.reels.close);

    // 5. Cart bar → cart → «Оформить» → login with SMS 0000 (asked only now) → checkout → pay → order screen.
    await app.openCart();
    await expectGoodUx(page, { screen: 'cart' });
    await app.checkoutAndPay();
    await expect(app.tid(TID.order.statusTitle)).toHaveText(/Заказ создан|Ресторан принял заказ|Готовим/);
    await app.expectNoErrors();
  });

  test.fixme('Skipping onboarding still yields a non-empty feed', async ({ app }) => {
    // 1. Fresh guest → onboarding → «Пропустить». 2. Home feed visible with ≥ 6 cards (neutral profile + popularity).
    await app.open({ skipOnboarding: false });
    await app.tap(TID.onboarding.skip);
    await app.home.expectOpen();
    await expect(app.page.locator('[data-testid^="home-dish-card-"]')).toHaveCount(6, { timeout: 10_000 }).catch(async () => {
      expect(await app.page.locator('[data-testid^="home-dish-card-"]').count()).toBeGreaterThanOrEqual(6);
    });
  });
});
