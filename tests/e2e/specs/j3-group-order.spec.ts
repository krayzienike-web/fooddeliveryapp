/**
 * J3 «Компания/семья»: заказываю на несколько человек — быстро собрать сет под людей и бюджет.
 * Сценарий: ИИ: «нас 4, бюджет 4000, один не ест мясо» → карточки → «Добавить всё»; групповая корзина.
 * The AI client must be deterministic in E2E (mock/offline answers when __ZHAR_E2E__ is set).
 */
import { test, expect, TID, expectGoodUx } from '../support/fixtures';

test.describe('J3 · Компания/семья', () => {
  test.fixme('AI assistant builds a set for 4 within 4000 ₽ incl. a meat-free option → «Добавить всё»', async ({ app, page }) => {
    // 1. Tab «Ассистент».
    await app.open();
    await app.goTab('assistant');
    await app.assistant.expectOpen();
    await expectGoodUx(page, { screen: 'assistant' });

    // 2. Type the request and send.
    await app.fill(TID.assistant.input, 'нас 4, бюджет 4000, один не ест мясо');
    await app.tap(TID.assistant.send);

    // 3. Assistant answers with dish suggestion cards (≥ 4), budget summary ≤ 4000 ₽, at least one veg card.
    const cards = page.locator('[data-testid^="assistant-suggestion-"]');
    await expect(cards.first()).toBeVisible({ timeout: 20_000 });
    expect(await cards.count()).toBeGreaterThanOrEqual(4);
    // 4. «Добавить всё» → cart bar total ≤ 4000 ₽ (+ delivery).
    await app.tap(TID.assistant.primaryCta);
    const total = await app.tid(TID.global.cartBarTotal).innerText();
    expect(Number(total.replace(/[^\d]/g, ''))).toBeLessThanOrEqual(4000);
  });

  test.fixme('Group cart: invite → lines show who added them', async ({ app }) => {
    // 1. Add any dish; open cart. 2. «Пригласить в корзину» → share sheet / link (web: copied toast).
    // 3. Director/mock adds a line from a friend → line shows avatar/name of member (cart-group-member-<id>).
    await app.open();
    await app.openCart();
    await app.tap(TID.cart.groupInvite);
    await expect(app.tid(TID.global.toast)).toBeVisible();
  });
});
