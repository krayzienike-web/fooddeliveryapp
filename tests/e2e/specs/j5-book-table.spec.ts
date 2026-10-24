/**
 * J5 «Иду в ресторан»: за минуту выбрать ресторан, стол, время и предзаказать еду.
 * Сценарий: Рестораны → ресторан → схема зала → стол → время → предзаказ → подтверждение.
 */
import { test, expect, TID, expectGoodUx, expectScreen } from '../support/fixtures';

test.describe('J5 · Иду в ресторан', () => {
  test.fixme('restaurant → floor plan → table → time → pre-order → confirmation', async ({ app, page }) => {
    await app.open({ loggedIn: true });

    // 1. Tab «Рестораны»: map + list; open the first restaurant.
    await app.goTab('restaurants');
    await app.restaurants.expectOpen();
    await expectGoodUx(page, { screen: 'restaurants', ignore: [`[data-testid="${TID.restaurants.map}"]`] });
    await page.locator('[data-testid^="restaurants-item-"]').first().click();
    await app.restaurant.expectOpen();

    // 2. «Забронировать стол» → booking screen with floor plan.
    await app.tap(TID.restaurant.book);
    await app.booking.expectOpen();
    await expect(app.tid(TID.booking.floorPlan)).toBeVisible();

    // 3. Guests = 2 (default) → choose a FREE table (busy ones are disabled: aria-disabled="true").
    const freeTable = page.locator('[data-testid^="booking-table-"]:not([aria-disabled="true"])').first();
    await freeTable.click();

    // 4. Choose time slot 19:00 (booking-time-19-00) → optional pre-order: add one dish.
    await app.tap(TID.booking.time('19:00'));
    await page.locator('[data-testid^="booking-preorder-add-"]').first().click();
    await expectGoodUx(page, { screen: 'booking' });
    await expectScreen(page, 'j5-booking-floor-plan');

    // 5. «Забронировать» → (login if needed) → confirmation with table, time and pre-order.
    await app.tap(TID.booking.primaryCta);
    await expect(app.tid(TID.booking.confirmation)).toBeVisible();
    await expect(app.tid(TID.booking.confirmation)).toContainText('19:00');
  });
});
