/**
 * C17 «За столом»: в ресторане сканирую QR на столе → дозаказываю к столу, зову официанта, делю и оплачиваю счёт.
 * Сценарий: Рестораны → «За столом» → демо-скан (стол 7) → дозаказ → официант → «Поровну»/«Моё» → чаевые → оплата → баллы.
 * Split math itself is unit-tested next to the code (src/features/table/model/__tests__/bill.test.ts).
 */
import { test, expect, TID, expectUx } from '../support/fixtures';

const rubles = (s: string) => Number(s.replace(/\D/g, ''));

test.describe('C17 · За столом (QR)', () => {
  test('scan → add to the table → call waiter → split equally → tips → pay → points', async ({ app, page }) => {
    await app.open({ loggedIn: true });
    await app.goTab('restaurants');
    await app.tap(TID.restaurants.qr);
    await app.qrMenu.expectOpen();
    await expect(app.tid(TID.qrMenu.viewfinder)).toBeVisible();
    await app.tap(TID.qrMenu.demoScan);
    await expect(app.tid(TID.qrMenu.bill)).toBeVisible();
    await expect(app.qrMenu.root).toContainText('Стол 7');

    // Order more to the table → the bill grows.
    const pay = app.tid(TID.qrMenu.pay);
    const all0 = rubles(await pay.innerText());
    await app.prefixed('qr-add-', app.qrMenu.root).first().click();
    await app.expectToast('Передали на кухню');
    await expect.poll(async () => rubles(await pay.innerText())).toBeGreaterThan(all0);

    await app.tap(TID.qrMenu.callWaiter);
    await app.expectToast(/подойдёт через \d+ мин/);

    // «Поровну» on 3 people → a third of the table (+ tips).
    const all = rubles(await pay.innerText());
    await app.tap(`${TID.qrMenu.splitMode}-equal`);
    await app.tap(`${TID.qrMenu.people}-inc`);
    await expect.poll(async () => rubles(await pay.innerText())).toBeLessThan(all / 2);
    await expectUx(page, 'qr-menu');

    // Tips 15 % make it bigger than without tips.
    await app.tap(TID.qrMenu.tips(0));
    const noTips = rubles(await pay.innerText());
    await app.tap(TID.qrMenu.tips(15));
    await expect.poll(async () => rubles(await pay.innerText())).toBeGreaterThan(noTips);

    await pay.click();
    await expect(app.tid(TID.qrMenu.paid)).toContainText(/Оплачено [\d\s]+₽/);
    await expect(app.tid(TID.qrMenu.paid)).toContainText(/Начислили [\d\s]+Б/);
    await app.tap(TID.qrMenu.rate);
    await app.expectToast('Спасибо! Передадим команде');
    await app.tap(TID.qrMenu.finish);
    await app.restaurants.expectOpen();
    await app.expectNoErrors();
  });

  test('«Моё»: pay only for the items I tick', async ({ app }) => {
    await app.open({ loggedIn: true });
    await app.goTab('restaurants');
    await app.tap(TID.restaurants.qr);
    await app.tap(TID.qrMenu.demoScan);
    await app.tap(`${TID.qrMenu.splitMode}-items`);
    await app.tap(TID.qrMenu.tips(0));
    const pay = app.tid(TID.qrMenu.pay);
    const one = rubles(await pay.innerText()); // first item is pre-selected as mine
    expect(one).toBeGreaterThan(0);
    await app.tap(TID.qrMenu.billItem(1));
    await expect.poll(async () => rubles(await pay.innerText())).toBeGreaterThan(one);
    // untick both → nothing to pay
    await app.tap(TID.qrMenu.billItem(0));
    await app.tap(TID.qrMenu.billItem(1));
    await expect(pay).toHaveText('Отметьте свои позиции');
    await expect(pay).toBeDisabled();
  });

  test('guest is asked to log in before paying', async ({ app }) => {
    await app.open();
    await app.goTab('restaurants');
    await app.tap(TID.restaurants.qr);
    await app.tap(TID.qrMenu.demoScan);
    await app.tap(TID.qrMenu.pay);
    await app.loginWithSms();
    await app.qrMenu.expectOpen();
    await app.tap(TID.qrMenu.pay);
    await expect(app.tid(TID.qrMenu.paid)).toBeVisible();
  });
});
