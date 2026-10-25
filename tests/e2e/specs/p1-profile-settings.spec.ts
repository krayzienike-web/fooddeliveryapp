/**
 * Profile & settings (A12, C15): профиль как хаб — заказы, брони, избранное, адреса; настройки — тема, диета,
 * персонализация (выкл → без предсказаний), удаление аккаунта в 2 шага, выход.
 */
import { test, expect, TID, expectUx, FRIDAY_EVENING, SUNDAY_NOON } from '../support/fixtures';

test.describe('Profile & settings', () => {
  test('profile hub: orders → repeat, bookings sheet → restaurants, favorites sheet', async ({ app, page }) => {
    await app.open({ loggedIn: true });
    await app.goTab('profile');
    await app.profile.expectOpen();
    await expectUx(page, 'profile');

    await app.tap(TID.profile.orders);
    await app.orders.expectOpen();
    const repeat = app.prefixed('orders-repeat-', app.orders.root).first();
    await repeat.click();
    await app.cart.expectOpen();
    await app.expectToast('Собрали корзину');
    await app.tap(TID.cart.close);
    await app.tap(TID.global.back); // Orders → Profile

    await app.tap(TID.profile.bookings);
    await expect(app.tid(TID.profile.bookingsSheet)).toBeVisible();
    await app.tap(TID.profile.bookTable);
    await app.restaurants.expectOpen();

    await app.goTab('profile');
    await app.tap(TID.profile.favorites);
    await expect(app.tid(TID.profile.favoritesSheet)).toBeVisible();
    await app.expectNoErrors();
  });

  test('a new booking appears in profile «Брони»', async ({ app }) => {
    await app.open({ loggedIn: true }, { now: SUNDAY_NOON });
    await app.goTab('restaurants');
    await app.tap(TID.restaurants.item('r-nevsky'));
    await app.tap(TID.restaurant.book);
    await app.tap(TID.booking.date(1));
    await app.tap(TID.booking.slot('19:00'));
    await app.tap(TID.booking.submit);
    await app.tap(TID.booking.finish);
    await app.tap(TID.restaurant.back);
    await app.goTab('profile');
    await expect(app.tid(TID.profile.bookings)).toContainText('1');
    await app.tap(TID.profile.bookings);
    await expect(app.tid(TID.profile.bookingsSheet)).toContainText('ЖАР на Невском');
  });

  test('settings: theme, diet, personalization off hides the Friday prediction', async ({ app, page }) => {
    await app.open({ loggedIn: true }, { now: FRIDAY_EVENING });
    await expect(app.tid(TID.home.prediction)).toBeVisible();
    await app.goTab('profile');
    await app.tap(TID.profile.settings);
    await app.screen('settings').expectOpen();
    await expectUx(page, 'settings');

    // Light theme changes the page background, dark brings it back.
    const bg = () => app.screen('settings').root.evaluate((el) => getComputedStyle(el).backgroundColor);
    const dark = await bg();
    await app.tap(`${TID.settings.theme}-light`);
    await expect.poll(bg).not.toBe(dark);
    await app.tap(`${TID.settings.theme}-dark`);
    await expect.poll(bg).toBe(dark);

    await app.tap(TID.settings.diet('veg'));
    await app.tap(TID.settings.personalization);
    await app.tap(TID.settings.back);
    await app.goTab('home');
    await expect(app.tid(TID.home.prediction)).toHaveCount(0);
  });

  test('reset taste profile', async ({ app }) => {
    await app.open({ loggedIn: true });
    await app.goTab('profile');
    await app.tap(TID.profile.settings);
    await app.tap(TID.settings.resetTaste);
    await app.expectToast('Вкусовой профиль сброшен');
  });

  test('delete account takes two confirmations; «Оставить» cancels', async ({ app }) => {
    await app.open({ loggedIn: true });
    await app.goTab('profile');
    await app.tap(TID.profile.settings);
    await app.tap(TID.settings.delete);
    await expect(app.tid(TID.settings.deleteSheet)).toContainText('Удалить аккаунт?');
    await app.tap(TID.settings.deleteCancel);
    await expect(app.tid(TID.settings.deleteSheet)).toBeHidden();
    await app.tap(TID.settings.delete);
    await app.tap(TID.settings.deleteNext);
    await expect(app.tid(TID.settings.deleteSheet)).toContainText('Точно удалить?');
    await app.tap(TID.settings.deleteConfirm);
    await app.expectToast('Аккаунт удалён');
  });

  test('logout asks for confirmation and returns the guest profile', async ({ app }) => {
    await app.open({ loggedIn: true });
    await app.goTab('profile');
    await app.tap(TID.profile.logout);
    await expect(app.tid(TID.profile.logoutSheet)).toBeVisible();
    await app.tap(TID.profile.logoutConfirm);
    await expect(app.tid(TID.profile.login)).toBeVisible();
    await app.tap(TID.profile.settingsGuest);
    await app.screen('settings').expectOpen();
    await expect(app.tid(TID.settings.delete)).toHaveCount(0);
  });
});
