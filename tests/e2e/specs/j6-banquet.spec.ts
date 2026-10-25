/**
 * J6 «Событие»: готовое банкетное предложение под гостей и бюджет.
 * Сценарий: Банкет: формат → ползунки гостей/бюджета → дата/повод/зал → меню от Шефа ИИ (живой пересчёт) → отправить менеджеру.
 * Sliders are react-native-gesture-handler pans: a finger tap on the track jumps there (app.touchTap).
 */
import { test, expect, TID, expectUx } from '../support/fixtures';

const rubles = (s: string) => Number(s.replace(/\D/g, ''));

test.describe('J6 · Событие', () => {
  test('restaurants → «Банкет» → sliders → AI menu → reshuffle → SMS → sent to manager', async ({ app, page }) => {
    await app.open();
    await app.goTab('restaurants');
    await app.tap(TID.restaurants.banquet);
    await app.banquet.expectOpen();

    // Menu is composed live; guests slider to max (120) changes the total.
    const total = app.tid(TID.banquet.total);
    await expect(app.tid(TID.banquet.menu)).toContainText('Меню от Шефа ИИ');
    const t0 = rubles(await total.innerText());
    await app.touchTap(app.tid(TID.banquet.guests), 0.99);
    await expect(app.banquet.root).toContainText('120');
    await expect.poll(async () => rubles(await total.innerText())).toBeGreaterThan(t0);

    // Budget per guest to max → total ≤ guests × budget and the per-guest line is shown.
    await app.touchTap(app.tid(TID.banquet.budget), 0.99);
    await expect(app.banquet.root).toContainText(/8\s000\s₽/);
    expect(rubles(await total.innerText())).toBeLessThanOrEqual(120 * 8000);
    await expect(app.tid(TID.banquet.menu)).toContainText(/на гостя · ~\d+ г еды на гостя/);

    // Format, date, occasion, hall.
    await app.tap(`${TID.banquet.format}-buffet`);
    await app.tap(TID.banquet.date(2));
    await app.tap(TID.banquet.occasion(0));
    const hall = app.prefixed('banquet-hall-', app.banquet.root).first();
    await hall.click();
    await expectUx(page, 'banquet');

    // «Другое» reshuffles the menu.
    const before = await app.tid(TID.banquet.menu).innerText();
    await app.tap(TID.banquet.reshuffle);
    await expect.poll(async () => app.tid(TID.banquet.menu).innerText()).not.toBe(before);

    // Logged out → SMS → back → send → «Анна перезвонит».
    await app.tap(TID.banquet.send);
    await app.loginWithSms();
    await app.banquet.expectOpen();
    await app.tap(TID.banquet.send);
    await expect(app.tid(TID.banquet.sent)).toContainText('Анна перезвонит в течение 15 минут');
    await app.tap(TID.banquet.finish);
    await app.restaurants.expectOpen();
    await app.expectNoErrors();
  });

  test('restaurant with a banquet hall opens the constructor pre-filled', async ({ app }) => {
    await app.open({ loggedIn: true });
    await app.goTab('restaurants');
    await app.tap(TID.restaurants.item('r-nevsky'));
    await app.tap(TID.restaurant.banquet);
    await app.banquet.expectOpen();
    await expect(app.tid(TID.banquet.menu)).toBeVisible();
    await app.tap(TID.banquet.send);
    await expect(app.tid(TID.banquet.sent)).toBeVisible();
  });

  test('catering needs no hall', async ({ app }) => {
    await app.open({ loggedIn: true });
    await app.goTab('restaurants');
    await app.tap(TID.restaurants.banquet);
    await app.tap(`${TID.banquet.format}-catering`);
    await expect(app.prefixed('banquet-hall-', app.banquet.root)).toHaveCount(0);
    await expect(app.tid(TID.banquet.send)).toBeEnabled();
  });
});
