/**
 * D0 «Ревью демо»: ревьюер копит правки по элементам разных экранов и отправляет их в работу одной пачкой.
 * Сценарий: «Правки» → «Отметить элемент» → тап по карточке блюда → тип + текст → в пачку → другой экран →
 *           «Весь экран» → правка → панель: правки сгруппированы по экранам, правка редактируется и удаляется →
 *           «Отправить в работу» → одна ветка «Send to Claude» с обеими правками → пачка пуста, «в работе у Claude».
 * The claude.ai runtime is stubbed: `window.claude.use('comments')` records what the page posts.
 */
import type { Page } from '@playwright/test';
import { test, expect, TID } from '../support/fixtures';

type Posted = { verb: 'sendToClaude' | 'create'; text: string };

async function stubComments(page: Page, can: 'available' | 'no_session') {
  await page.addInitScript((can) => {
    const posted: Array<{ verb: string; text: string }> = [];
    (window as unknown as { __posted: unknown }).__posted = posted;
    const comments = {
      anchorFor: async () => ({ path: '#root', x: 10, y: 10 }),
      canSendToClaude: async () => can,
      sendToClaude: async (o: { text: string }) => (posted.push({ verb: 'sendToClaude', text: o.text }), { threadId: 't1', commentId: 'c1' }),
      create: async (o: { text: string }) => (posted.push({ verb: 'create', text: o.text }), { threadId: 't2', commentId: 'c2' }),
      customAnchors: () => new Promise(() => undefined),
    };
    (window as unknown as { claude: unknown }).claude = { use: async (name: string) => (name === 'comments' ? comments : null) };
  }, can);
}

const posted = (page: Page) => page.evaluate(() => (window as unknown as { __posted: Posted[] }).__posted);

test.describe('D0 · Ревью пачкой', () => {
  test('mark an element + a whole screen → edit → send the batch to Claude in one thread', async ({ app, page }) => {
    await stubComments(page, 'available');
    await app.open({ review: true });

    await app.tap(TID.review.fab);
    await expect(app.tid(TID.review.empty)).toBeVisible();
    await app.tap(TID.review.pick);
    await expect(app.tid(TID.review.picking)).toBeVisible();

    // Picking: a tap on a dish card tags it instead of opening the dish.
    const card = app.home.root.locator('[data-testid^="dish-card-"]').first();
    const cardId = (await card.getAttribute('data-testid'))!;
    await card.click();
    await expect(app.tid(TID.review.composer)).toBeVisible();
    await expect(app.home.root).toBeVisible(); // still on Home
    await expect(app.tid(TID.review.save)).toBeDisabled();
    await app.tap(TID.review.kind('bug'));
    await app.fill(TID.review.text, 'Цена налезает на название');
    await app.tap(TID.review.save);
    await app.expectToast('Добавлено в пачку');
    await expect(app.tid(TID.review.fab)).toContainText('1');

    // Another screen, a note about the screen as a whole.
    await app.goTab('restaurants');
    await app.tap(TID.review.fab);
    await app.tap(TID.review.screenNote);
    await expect(app.tid(TID.review.target)).toHaveText('Рестораны');
    await app.fill(TID.review.text, 'Не хватает фильтра «открыто сейчас»');
    await app.tap(TID.review.save);

    // Panel: grouped by screen, editable.
    await app.tap(TID.review.fab);
    await expect(app.tid(TID.review.panel)).toContainText('Главная');
    await expect(app.tid(TID.review.panel)).toContainText('Рестораны');
    await app.tap(TID.review.draft(1));
    await app.fill(TID.review.text, 'Нужен фильтр «открыто сейчас»');
    await app.tap(TID.review.save);
    await app.expectToast('Правка обновлена');

    await app.tap(TID.review.fab);
    await expect(app.tid(TID.review.send)).toHaveText(/Отправить в работу · 2/);
    await app.tap(TID.review.send);
    await app.expectToast('Отправлено в работу: 2');

    const sent = await posted(page);
    expect(sent).toHaveLength(1);
    expect(sent[0].verb).toBe('sendToClaude');
    expect(sent[0].text).toContain('Пачка правок из ревью демо ЖАР: 2 шт.');
    expect(sent[0].text).toContain(`1. [Баг] Home › ${cardId}`);
    expect(sent[0].text).toContain('2. [Правка] Restaurants › screen\n   Нужен фильтр «открыто сейчас»');

    await expect(app.tid(TID.review.fab)).not.toContainText(/\d/);
    await app.tap(TID.review.fab);
    await expect(app.tid(TID.review.empty)).toBeVisible();
    await expect(app.tid(TID.review.lastSent)).toContainText('2 шт.');
    await expect(app.tid(TID.review.lastSent)).toContainText('в работе у Claude');
    await app.expectNoErrors();
  });

  test('cancel picking, delete a draft; with no Claude session the batch is saved as a comment', async ({ app, page }) => {
    await stubComments(page, 'no_session');
    await app.open({ review: true });

    await app.tap(TID.review.fab);
    await app.tap(TID.review.pick);
    await app.tap(TID.review.pickCancel);
    await expect(app.tid(TID.review.panel)).toBeVisible();
    await expect(app.tid(TID.review.picking)).toHaveCount(0);

    for (const text of ['Первая', 'Вторая']) {
      await app.tap(TID.review.screenNote);
      await app.fill(TID.review.text, text);
      await app.tap(TID.review.save);
      await app.tap(TID.review.fab);
    }
    await app.tap(TID.review.draft(0));
    await app.tap(TID.review.remove);
    await app.tap(TID.review.fab);
    await expect(app.tid(TID.review.send)).toHaveText(/Сохранить пачкой в комментарии · 1/);
    await expect(app.tid(TID.review.channel)).toContainText('забери правки');
    await app.tap(TID.review.send);
    await app.expectToast('Пачка сохранена в комментариях');

    const sent = await posted(page);
    expect(sent.map((s) => s.verb)).toEqual(['create']);
    expect(sent[0].text).toContain('Вторая');
    expect(sent[0].text).not.toContain('Первая');
  });
});
