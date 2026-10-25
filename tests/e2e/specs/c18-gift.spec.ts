/**
 * C18 «Подарок»: дарю сертификат ЖАР другу.
 * Сценарий: Рестораны → «Подарок» → дизайн → сумма → имя и телефон (кнопка неактивна, пока не заполнены) → пожелание
 *           → когда отправить → «Подарить» → код сертификата.
 */
import { test, expect, TID, expectUx } from '../support/fixtures';

test.describe('C18 · Подарок', () => {
  test('design → amount → recipient → wish → send now → code', async ({ app, page }) => {
    await app.open({ loggedIn: true });
    await app.goTab('restaurants');
    await app.tap(TID.restaurants.gift);
    await app.gift.expectOpen();

    // Live preview follows the choices.
    await app.tap(TID.gift.design('party'));
    await app.tap(TID.gift.amount(5000));
    await expect(app.tid(TID.gift.preview)).toContainText(/5\s000\s₽/);

    const send = app.tid(TID.gift.send);
    await expect(send).toBeDisabled();
    await expect(send).toHaveText('Укажите имя и телефон');
    await app.fill(TID.gift.name, 'Аня');
    await expect(send).toBeDisabled(); // phone still missing
    await app.fill(TID.gift.phone, '921555123'); // 9 digits
    await expect(send).toBeDisabled();
    await app.fill(TID.gift.phone, '9215551234');
    await expect(app.tid(TID.gift.phone)).toHaveValue('+7 (921) 555-12-34');
    await expect(send).toBeEnabled();
    await expect(send).toHaveText(/Подарить · 5\s000\s₽/);
    await expect(app.tid(TID.gift.preview)).toContainText('Аня');

    await app.tap(TID.gift.message(1));
    await app.tap(TID.gift.when(1));
    await app.tap(TID.gift.whenNow);
    await expectUx(page, 'gift');

    await send.click();
    await expect(app.tid(TID.gift.sent)).toBeVisible();
    await expect(app.tid(TID.gift.code)).toHaveText(/\S{4,}/);
    await app.tap(TID.gift.code);
    await app.expectToast('Код скопирован');
    await app.tap(TID.gift.finish);
    await app.restaurants.expectOpen();
    await app.expectNoErrors();
  });

  test('guest fills the form and is asked to log in on send', async ({ app }) => {
    await app.open();
    await app.goTab('restaurants');
    await app.tap(TID.restaurants.gift);
    await app.fill(TID.gift.name, 'Петя');
    await app.fill(TID.gift.phone, '9990001122');
    await app.tap(TID.gift.send);
    await app.loginWithSms();
    await app.gift.expectOpen();
    await expect(app.tid(TID.gift.name)).toHaveValue('Петя'); // form survives the login detour
  });
});
