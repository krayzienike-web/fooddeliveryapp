/**
 * B1 «Шеф ИИ»: заказ разговором — генеративные карточки блюд, брони и банкета, follow-up подсказки.
 * In e2e the assistant always answers with the deterministic offline brain (src/features/ai-assistant/model/scripted.ts;
 * `IS_E2E` short-circuits getAiClient), with a ~450 ms «typing» beat.
 */
import { test, expect, TID, expectUx, SUNDAY_NOON, type App } from '../support/fixtures';

const rubles = (s: string) => Number(s.replace(/\D/g, ''));
const chip = (app: App, text: string) => app.prefixed('assistant-chip-', app.assistant.root).filter({ hasText: text });
const lastCard = (app: App) => app.tid(TID.assistant.cardDishes).last();

async function openAssistant(app: App, flags = {}) {
  await app.open(flags, { now: SUNDAY_NOON });
  await app.goTab('assistant');
  await app.assistant.expectOpen();
}

test.describe('B1 · Шеф ИИ', () => {
  test('starter «Ужин на четверых до 3000 ₽» → dish card → «Добавить всё» → cart has every item', async ({ app, page }) => {
    await openAssistant(app);
    await expect(app.tid(TID.assistant.starter(0))).toHaveText(/Ужин на четверых до 3000 ₽/);
    await expectUx(page, 'assistant');
    await app.tap(TID.assistant.starter(0));

    await expect(app.tid(TID.assistant.thinking).or(lastCard(app))).toBeVisible();
    await expect(lastCard(app)).toBeVisible();
    await expect(app.tid(TID.assistant.mode)).toHaveText('Быстрые ответы'); // offline brain
    await expect(app.tid(TID.assistant.replyText).last()).toContainText(/на 4 гостей/);
    const addAll = app.tid(TID.assistant.addAll);
    const total = rubles(await addAll.innerText());
    expect(total).toBeLessThanOrEqual(3000);
    const dishIds = await app.prefixed('assistant-dish-', lastCard(app)).evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.replace('assistant-dish-', '')));
    expect(dishIds.length).toBeGreaterThanOrEqual(3);
    await expectUx(page, 'assistant');

    await addAll.click();
    await app.expectToast(/Добавили \d+ позиц/);
    await app.tap(TID.assistant.toCart); // «В корзине · перейти»
    await app.cart.expectOpen();
    for (const id of dishIds) await expect(app.tid(TID.cart.line(id))).toBeVisible();
    expect(rubles(await app.tid(TID.cart.total).innerText())).toBeGreaterThanOrEqual(total);

    // The cart bar on Home shows the same items.
    await app.tap(TID.cart.close);
    await app.goTab('home');
    await expect(app.tid(TID.global.cartBar)).toBeVisible();
    await app.expectNoErrors();
  });

  test('follow-up chips: «Дешевле» lowers the total, «Добавить десерт» adds a dessert', async ({ app }) => {
    await openAssistant(app);
    await app.tap(TID.assistant.starter(0));
    await expect(lastCard(app)).toBeVisible();
    const first = rubles(await app.tid(TID.assistant.addAll).last().innerText());

    await chip(app, 'Дешевле').click();
    await expect(app.tid(TID.assistant.cardDishes)).toHaveCount(2);
    const cheaper = rubles(await app.tid(TID.assistant.addAll).last().innerText());
    expect(cheaper).toBeLessThan(first);

    await chip(app, 'Добавить десерт').click();
    await expect(app.tid(TID.assistant.replyText).last()).toContainText(/десерт/i);
    await expect(app.prefixed('assistant-dish-des-', app.assistant.root).first()).toBeVisible();
  });

  test('typed request: «Столик на завтра в 19:00 на двоих» → booking card → pre-filled booking screen', async ({ app }) => {
    await openAssistant(app, { loggedIn: true });
    await app.fill(TID.assistant.input, 'Столик на завтра в 19:00 на двоих');
    await app.tap(TID.assistant.send);
    const card = app.tid(TID.assistant.cardBooking);
    await expect(card).toBeVisible();
    await expect(card).toContainText('Завтра');
    await expect(card).toContainText('19:00');
    await expect(card).toContainText('2 гостя');

    await app.tap(TID.assistant.bookingOpen);
    await app.booking.expectOpen();
    await expect(app.tid(TID.booking.guests)).toContainText('2');
    await expect(app.tid(TID.booking.tableSummary)).toBeVisible();
    await expect(app.tid(TID.booking.submit)).toHaveText(/Забронировать на 19:00/);
    await app.tap(TID.booking.submit);
    await expect(app.tid(TID.booking.done)).toContainText('19:00');
  });

  test('«банкет на 30 гостей» → banquet card → constructor', async ({ app }) => {
    await openAssistant(app);
    await app.fill(TID.assistant.input, 'Хочу банкет на 30 гостей');
    await app.tap(TID.assistant.send);
    await expect(app.tid(TID.assistant.cardBanquet)).toContainText('30');
    await app.tap(TID.assistant.banquetOpen);
    await app.banquet.expectOpen();
    await expect(app.banquet.root).toContainText('30');
  });

  test('search with no results → «Спросить у Шефа ИИ» hands the query over', async ({ app }) => {
    await app.open();
    await app.tap(TID.home.search);
    await app.search.expectOpen();
    await app.fill(TID.search.input, 'что-нибудь на ужин вдвоём');
    await app.tap(TID.search.askAi);
    await app.assistant.expectOpen();
    await expect(app.assistant.root).toContainText('что-нибудь на ужин вдвоём');
    await expect(app.tid(TID.assistant.reply).last()).not.toContainText('Шеф думает');
    await expect(app.tid(TID.assistant.replyText).last()).toBeVisible();
  });

  test('«Новый диалог» returns to the starters', async ({ app }) => {
    await openAssistant(app);
    await app.tap(TID.assistant.starter(2));
    await expect(app.tid(TID.assistant.replyText).last()).toBeVisible();
    await app.tap(TID.assistant.reset);
    await expect(app.tid(TID.assistant.starter(0))).toBeVisible();
  });

  test('with an active order the starter asks «Где мой заказ?» and shows the order card', async ({ app }) => {
    await app.open({ loggedIn: true, speed: 1 });
    await app.placeOrder();
    await app.tap(TID.order.back);
    await app.goTab('assistant');
    await expect(app.tid(TID.assistant.starter(3))).toHaveText(/Где мой заказ\?/);
    await app.tap(TID.assistant.starter(3));
    await expect(app.tid(TID.assistant.cardOrder)).toBeVisible();
    await app.tid(TID.assistant.cardOrder).click();
    await app.order.expectOpen();
  });
});
