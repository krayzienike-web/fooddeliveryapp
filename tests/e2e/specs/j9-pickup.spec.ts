/**
 * J9 «Самовывоз»: я рядом с рестораном — забрать без ожидания.
 * Сценарий: Режим «Самовывоз» → ресторан → оплата (−10%) → «Я подхожу» → номер полки → «Я на месте» → выдан.
 * Mock: «Я подхожу» while cooking fast-forwards the kitchen; ready_for_pickup waits until «Я на месте».
 */
import { test, expect, TID, expectUx } from '../support/fixtures';

const rubles = (s: string) => Number(s.replace(/\D/g, ''));

test.describe('J9 · Самовывоз', () => {
  test('pickup mode → −10% → pay → «Я подхожу» → shelf number → «Я на месте» → picked up', async ({ app, page }) => {
    test.setTimeout(90_000);
    await app.open({ loggedIn: true, speed: 4 });

    // 1. Home: «Самовывоз» switches the header to the restaurant.
    await app.tap(TID.home.modePickup);
    await expect(app.tid(TID.home.address)).toContainText('Самовывоз из');

    // 2. Cart: pickup discount, no delivery fee, no free-delivery progress.
    await app.addFromFeed();
    await app.openCart();
    await expect(app.cart.root).toContainText('Скидка за самовывоз');
    await expect(app.tid(TID.cart.toFreeDelivery)).toHaveCount(0);
    const total = rubles(await app.tid(TID.cart.total).innerText());

    // 3. Checkout: restaurant instead of address, same total.
    await app.tap(TID.cart.primaryCta);
    await app.checkout.expectOpen();
    await expect(app.tid(TID.checkout.address)).toHaveCount(0);
    await expect(app.prefixed('checkout-restaurant-', app.checkout.root)).toContainText('готов за');
    expect(rubles(await app.tid(TID.checkout.total).innerText())).toBe(total);
    await expectUx(page, 'checkout');
    await app.slideToPay();
    await app.order.expectOpen();

    // 4. Pickup order: no courier map; «Я подхожу» → kitchen hurries → shelf number.
    await expect(app.tid(TID.order.courierMap)).toHaveCount(0);
    await expect(app.tid(TID.order.progress)).toContainText('Получен');
    await app.tap(TID.order.pickupArriving);
    await app.expectToast('Кухня знает, что вы рядом');
    await expect(app.tid(TID.order.pickupShelf)).toHaveText(/\S+/, { timeout: 45_000 });
    await app.expectStatus(/Готов/);

    // 5. «Я на месте — выдайте заказ» → picked up.
    await expect(app.tid(TID.order.pickupArriving)).toContainText('Я на месте');
    await app.tap(TID.order.pickupArriving);
    await expect(app.order.root).toContainText('Приятного аппетита!', { timeout: 15_000 });
    await expect(app.tid(TID.order.rateStar(5))).toBeVisible();
    await app.expectNoErrors();
  });
});
