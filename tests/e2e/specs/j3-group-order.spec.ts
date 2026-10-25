/**
 * J3 «Компания/семья»: Когда заказываю на несколько человек, хочу быстро собрать сет под людей и бюджет.
 * Сценарий: ИИ: «нас 4, бюджет 4000, один не ест мясо» → карточки → «Добавить всё»; групповая корзина.
 * «Шеф ИИ» answers with the deterministic offline brain in e2e (scripted.ts).
 */
import { test, expect, TID, expectUx } from '../support/fixtures';

const rubles = (s: string) => Number(s.replace(/\D/g, ''));

test.describe('J3 · Компания/семья', () => {
  test('AI set for 4 within budget → «Добавить всё» → cart', async ({ app, page }) => {
    await app.open();
    await app.goTab('assistant');
    await app.assistant.expectOpen();
    await app.fill(TID.assistant.input, 'нас 4, бюджет 4000, один не ест мясо');
    await app.tap(TID.assistant.send);

    const card = app.tid(TID.assistant.cardDishes);
    await expect(card).toBeVisible();
    await expect(app.tid(TID.assistant.replyText).last()).toContainText(/4/);
    const addAll = app.tid(TID.assistant.addAll);
    const total = rubles(await addAll.innerText());
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(4000);
    // Vegetarian guest: at least one veggie-friendly dish is in the set (tagged in the seed); here we only check variety.
    expect(await app.prefixed('assistant-dish-', card).count()).toBeGreaterThanOrEqual(3);
    await expectUx(page, 'assistant');

    await addAll.click();
    await app.expectToast(/Добавили \d+ позиц/);
    await app.tap(TID.assistant.toCart);
    await app.cart.expectOpen();
    expect(rubles(await app.tid(TID.cart.total).innerText())).toBeGreaterThanOrEqual(total);
    await app.expectNoErrors();
  });

  test('group cart: share link → friends join and add their dishes → split', async ({ app }) => {
    test.setTimeout(60_000);
    await app.open({ loggedIn: true });
    await app.addFromFeed();
    await app.openCart();
    await app.tap(TID.cart.groupInvite);
    await app.groupCart.expectOpen();
    await app.groupCart.primaryCta.click(); // «Скопировать ссылку и начать»
    await app.expectToast(/Ссылка скопирована|присоединил/);

    // Demo friends (Маша, Дима) join within ~6 s and add 2 dishes each.
    await expect(app.groupCart.root).toContainText('Маша', { timeout: 15_000 });
    await expect(app.groupCart.root).toContainText('Дима', { timeout: 15_000 });
    await expect(app.groupCart.primaryCta).toContainText('Перейти к оплате своей части', { timeout: 15_000 });

    // «Поровну» changes my share (selected state is not exposed as aria-selected on web, so compare the amount).
    await expect(app.groupCart.root).toContainText('Картофель фри', { timeout: 15_000 }); // Дима's last pick
    const own = rubles(await app.groupCart.primaryCta.innerText());
    await app.tap(`${TID.groupCart.split}-equal`);
    await expect.poll(async () => rubles(await app.groupCart.primaryCta.innerText())).not.toBe(own);

    await app.groupCart.primaryCta.click();
    await app.cart.expectOpen();
    await expect(app.tid(TID.cart.groupBanner)).toContainText('3 участника');
    await expect(app.cart.all('cart-line-')).toHaveCount(5, { timeout: 15_000 });
  });
});
