/**
 * J1 «Голоден сейчас»: Когда я голоден и не знаю чего хочу, я хочу быстро увидеть аппетитные варианты под мой вкус.
 * Сценарий: Онбординг «Вкусовая ДНК» (8 свайпов → радар) → главная с персональной подборкой → Reels → «+» с видео → оформление.
 */
import { test, expect, TID, expectUx } from '../support/fixtures';

/** Taste deck (DECK in OnboardingScreen.tsx): the top card and the next one are rendered, so card N+2 appearing proves a swipe. */
const DECK_3RD = 'Том ям с креветками';
const DECK_4TH = 'Дабл бекон';

test.describe('J1 · Голоден сейчас', () => {
  test('taste DNA swipe deck → radar → personal feed → Reels «+» → SMS login → slide to pay', async ({ app, page }) => {
    // 1. Fresh guest → onboarding intro.
    await app.open({ skipOnboarding: false });
    await app.onboarding.expectOpen();
    await expectUx(page, 'onboarding');
    await app.tap(TID.onboarding.primaryCta); // «Найти мой вкус · 15 секунд»

    // 2. Swipe deck: progress bar; first card by a real drag to the right, the rest with «Хочу» / «Не моё».
    await expect(app.tid(TID.onboarding.progress)).toBeVisible();
    await expect(page.getByText('Хочется или нет?')).toBeVisible();
    // 8 bars = deck loaded (the deck is empty until the menu arrives — see BUG note in the third test).
    await expect(app.tid(TID.onboarding.progress).locator('> div')).toHaveCount(8);
    // NEEDS testID: the swipe card itself (suggested `onboarding-card-<dishId>`); we swipe from the viewport centre.
    // Asian + seafood lover: «Не моё» pepperoni (swipe left), «Хочу» Philadelphia (swipe right), then buttons.
    // (Liking everything averages the vector out → no axis passes 0.62 and the feed shows no «почему» chips.)
    await app.swipeTasteCard(false);
    await expect(page.getByText(DECK_3RD, { exact: true })).toBeVisible();
    await app.swipeTasteCard(true);
    await expect(page.getByText(DECK_4TH, { exact: true })).toBeVisible();
    for (const like of [true, false, true, true, false, false]) await app.tap(like ? TID.onboarding.like : TID.onboarding.no);

    // 3. Radar «Ваша вкусовая ДНК» → «Поехали».
    await expect(page.getByText('Ваша вкусовая ДНК', { exact: false })).toBeVisible();
    await expect(app.onboarding.root.locator('svg polygon').first()).toBeVisible();
    await expectUx(page, 'onboarding');
    await app.tap(TID.onboarding.primaryCta);

    // 4. Home: personal feed with «почему» explanations; guest browsing (no login wall).
    await app.home.expectOpen();
    await expect(page.getByText('Подобрали по вашей вкусовой ДНК')).toBeVisible();
    await expect(app.prefixed('dish-card-', app.feed)).toHaveCount(10);
    await expect(app.prefixed('dish-why-', app.feed).first()).toBeVisible();
    await expect(app.auth.root).toBeHidden();
    await expectUx(page, 'home');

    // 5. Reels → like → «+» straight from the video → the cart badge counts it.
    await app.tap(TID.home.reelsEntry);
    await app.reels.expectOpen();
    await app.tid(TID.reels.like).first().click();
    await app.tid(TID.reels.add).first().click();
    await expect(app.tid(TID.reels.cart)).toContainText('1');
    await app.tap(TID.reels.close);

    // 6. Cart bar → cart → «К оформлению» → SMS login (asked only now) → checkout → slide to pay → order.
    await expect(app.tid(TID.global.cartBar)).toBeVisible();
    await app.openCart();
    await expect(app.cart.all('cart-line-')).toHaveCount(1);
    await expectUx(page, 'cart');
    await app.checkoutAndPay({ slide: true });
    await app.expectStatus(/Заказ создан|Ресторан принял заказ|Готовим|Упаковываем|Курьер/);
    await app.expectNoErrors();
  });

  test('«Сразу в меню» skips onboarding and still yields a popular feed', async ({ app, page }) => {
    await app.open({ skipOnboarding: false });
    await app.tap(TID.onboarding.skip);
    await app.home.expectOpen();
    await expect(page.getByText('Самое популярное в Петербурге сейчас')).toBeVisible();
    await expect(app.prefixed('dish-card-', app.feed)).toHaveCount(10);
    // Not onboarded → no taste explanations.
    await expect(app.prefixed('dish-why-', app.feed)).toHaveCount(0);
  });

  test('«Пропустить» in the middle of the deck lands on Home', async ({ app }) => {
    await app.open({ skipOnboarding: false });
    await app.tap(TID.onboarding.primaryCta);
    // BUG (OnboardingScreen.tsx): the deck is built from the menu store; if «Найти мой вкус» is tapped before the menu
    // has loaded, the deck is empty and the first «Хочу» jumps straight to the radar with no signal recorded.
    await expect(app.tid(TID.onboarding.progress).locator('> div')).toHaveCount(8);
    await app.tap(TID.onboarding.like);
    await app.tap(TID.onboarding.skip);
    await app.home.expectOpen();
  });
});
