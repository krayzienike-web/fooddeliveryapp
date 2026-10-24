/**
 * J9 «Самовывоз»: я рядом с рестораном — забрать без ожидания.
 * Сценарий: Режим «Самовывоз» → ресторан → оплата → «Я подхожу» → номер полки.
 */
import { test, expect, TID, expectGoodUx } from '../support/fixtures';

test.describe('J9 · Самовывоз', () => {
  test.fixme('pickup mode → restaurant → pay (−10%) → «Я подхожу» → shelf number', async ({ app, page }) => {
    test.setTimeout(120_000);
    await app.open({ loggedIn: true, speed: 60 });

    // 1. Home: switch to «Самовывоз».
    await app.tap(TID.home.modePickup);
    await expect(app.tid(TID.home.modePickup)).toHaveAttribute('aria-selected', 'true');

    // 2. Add a dish → cart → checkout in pickup mode: restaurant picker, no address, 10% pickup discount visible.
    await page.locator('[data-testid^="home-dish-add-"]').first().click();
    await app.openCart();
    await app.tap(TID.cart.primaryCta);
    if (await app.auth.root.isVisible().catch(() => false)) await app.loginWithSms();
    await app.checkout.expectOpen();
    await expect(app.tid(TID.checkout.address)).toBeHidden();
    await page.locator('[data-testid^="checkout-restaurant-"]').first().click();
    await expect(page.getByText(/−10%|самовывоз/i).first()).toBeVisible();
    await expectGoodUx(page, { screen: 'checkout-pickup' });
    await app.tap(TID.checkout.primaryCta);

    // 3. Order screen (pickup flow, no courier) → when «Готов к выдаче», tap «Я подхожу» → shelf number shown.
    await app.order.expectOpen();
    await expect(app.tid(TID.order.courierMap)).toBeHidden();
    await expect(app.tid(TID.order.pickupArriving)).toBeVisible({ timeout: 60_000 });
    await app.tap(TID.order.pickupArriving);
    await expect(app.tid(TID.order.pickupShelf)).toHaveText(/\d+|[A-ZА-Я]-?\d+/);
  });
});
