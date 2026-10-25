/**
 * J5 «Иду в ресторан»: за минуту выбрать ресторан, стол, время и предзаказать еду.
 * Сценарий: Рестораны → ресторан → «Забронировать стол» → дата → гости → время → стол (автоподбор / схема зала)
 *           → повод → предзаказ → (вход по SMS) → подтверждение → календарь.
 * The AI entry point (assistant booking card → pre-filled booking) is covered in assistant.spec.ts.
 */
import { test, expect, TID, expectUx } from '../support/fixtures';

test.describe('J5 · Иду в ресторан', () => {
  test('list → restaurant → tomorrow 19:00 for 3 → auto-picked table → pre-order → SMS → confirmation', async ({ app, page }) => {
    await app.open();

    // 1. «Рестораны» tab: list with shortcuts; open «ЖАР на Невском».
    await app.goTab('restaurants');
    await app.restaurants.expectOpen();
    await expect(app.prefixed('restaurants-item-', app.restaurants.root)).toHaveCount(8);
    await expectUx(page, 'restaurants');
    await app.tap(TID.restaurants.item('r-nevsky'));
    await app.restaurant.expectOpen();
    await expect(app.restaurant.root).toContainText('ЖАР на Невском');
    await expectUx(page, 'restaurant');

    // 2. «Забронировать стол» → booking: tomorrow, 3 guests, 19:00 → a table is picked automatically.
    await app.tap(TID.restaurant.book);
    await app.booking.expectOpen();
    await app.tap(TID.booking.date(1));
    await app.tap(TID.booking.guestsInc);
    await expect(app.tid(TID.booking.guests)).toContainText('3');
    await app.tap(TID.booking.slot('19:00'));
    await expect(app.tid(TID.booking.tableSummary)).toContainText('Подобрали стол');
    await expect(app.tid(TID.booking.floorPlan)).toBeVisible();
    await expectUx(page, 'booking');

    // 3. Occasion + pre-order one dish.
    await app.tap(TID.booking.occasion(0));
    await app.tap(TID.booking.preorderToggle);
    const firstPre = app.prefixed('booking-preorder-', app.booking.root).filter({ hasNot: page.locator('[data-testid$="-toggle"]') });
    const inc = app.booking.root.locator('[data-testid^="booking-preorder-"][data-testid$="-inc"]').first();
    await inc.click();
    await expect(firstPre.first()).toBeVisible();
    await expect(app.tid(TID.booking.submit)).toHaveText(/Забронировать на 19:00/);

    // 4. Logged out → SMS (0000) → back on booking → submit again → confirmation.
    await app.tap(TID.booking.submit);
    await app.loginWithSms();
    await app.booking.expectOpen();
    await app.tap(TID.booking.submit);
    const done = app.tid(TID.booking.done);
    await expect(done).toBeVisible();
    await expect(done).toContainText('19:00');
    await expect(done).toContainText('3 гостя');
    await expect(done).toContainText('Невский пр., 74');
    await expectUx(page, 'booking');

    await app.tap(TID.booking.calendar);
    await app.expectToast('Напомним за 2 часа до визита');
    await app.tap(TID.booking.finish);
    await app.restaurant.expectOpen();
    await app.expectNoErrors();
  });

  test('choosing another free table on the floor plan; busy tables are disabled', async ({ app }) => {
    await app.open({ loggedIn: true });
    await app.goTab('restaurants');
    await app.tap(TID.restaurants.item('r-nevsky'));
    await app.tap(TID.restaurant.book);
    await app.tap(TID.booking.date(1));
    await app.tap(TID.booking.slot('19:00'));
    const summary = app.tid(TID.booking.tableSummary);
    await expect(summary).toContainText('Подобрали стол');
    const auto = (await summary.innerText()).match(/стол (\S+)/i)?.[1];

    const free = app.tid(TID.booking.floorPlan).locator('[data-testid^="booking-table-"]:not([aria-disabled="true"])');
    const other = free.filter({ hasNotText: new RegExp(`^${auto}`) }).first();
    const label = (await other.innerText()).split('\n')[0];
    await other.click();
    await expect(summary).toContainText(`Стол ${label}`);
    await app.tap(TID.booking.submit);
    await expect(app.tid(TID.booking.done)).toContainText(`стол ${label.replace(/^\D+/, '')}`);
  });

  test('more than 12 guests leads to the banquet constructor', async ({ app }) => {
    await app.open();
    await app.goTab('restaurants');
    await app.tap(TID.restaurants.item('r-nevsky'));
    await app.tap(TID.restaurant.book);
    for (let i = 2; i < 12; i++) await app.tap(TID.booking.guestsInc);
    await expect(app.tid(TID.booking.guests)).toContainText('12');
    await app.tap(TID.booking.guestsInc);
    await app.banquet.expectOpen();
  });

  test('map view: first tap selects a restaurant, second opens it', async ({ app }) => {
    await app.open();
    await app.goTab('restaurants');
    await app.tap(`${TID.restaurants.view}-map`);
    await expect(app.tid(TID.restaurants.map)).toBeVisible();
    // The nearest restaurant is pre-selected; another card needs two taps (select → open).
    const card = app.prefixed('restaurants-map-item-', app.restaurants.root).nth(1);
    await card.click();
    await expect(card).toContainText('Открыть');
    await card.click();
    await app.restaurant.expectOpen();
  });

  test('restaurant «Забрать за N мин» switches to the menu', async ({ app }) => {
    await app.open();
    await app.goTab('restaurants');
    await app.tap(TID.restaurants.item('r-rubinshteyna'));
    await app.tap(TID.restaurant.pickup);
    await app.expectToast('Самовывоз из «ЖАР на Рубинштейна»');
    await app.menu.expectOpen();
  });
});
