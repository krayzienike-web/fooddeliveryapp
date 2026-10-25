/**
 * A1 «Каталог → корзина»: гость листает меню, настраивает блюдо, правит корзину и промокод.
 * Сценарий: Меню → категория «Пицца» → карточка → размер/борт/добавки/qty (живая цена) → корзина → +/− → промокод → очистить.
 * Prices come from the seed (Пепперони Жар 690 ₽; 35 см +220, сырный борт +159, бекон +129).
 */
import { test, expect, TID, expectUx } from '../support/fixtures';

const rubles = (s: string) => Number(s.replace(/\D/g, ''));

test.describe('A1 · Каталог и корзина', () => {
  test('menu → pizza → options with live price → cart → qty → promo → clear', async ({ app, page }) => {
    await app.open();
    await app.goTab('menu');
    await app.menu.expectOpen();
    await app.tap(TID.menu.tab('pizza'));
    await expect(app.tid(TID.menu.section('pizza'))).toBeInViewport();
    await expectUx(page, 'menu');

    await app.menu.root.getByTestId(TID.dishCard.card('pz-pepperoni')).click();
    await app.dish.expectOpen();
    await expect(app.tid(TID.dish.title)).toHaveText('Пепперони Жар');
    const cta = app.tid(TID.dish.primaryCta);
    await expect(cta).toContainText('690');
    await app.tap(`${TID.dish.group('pizza-size')}-pz-35`);
    await app.tap(TID.dish.option('cr-cheese'));
    await app.tap(TID.dish.option('px-bacon'));
    await expect.poll(async () => rubles(await cta.innerText())).toBe(690 + 220 + 159 + 129);
    await app.tap(TID.dish.qtyInc);
    await expect(app.tid(TID.dish.qty)).toContainText('2');
    await expect.poll(async () => rubles(await cta.innerText())).toBe(2 * 1198);
    await app.tap(TID.dish.more);
    await expect(app.dish.root).toContainText('Аллергены');
    await expectUx(page, 'dish');
    await cta.click();

    // Back on the menu: cart bar shows the line.
    await app.menu.expectOpen();
    await expect(app.tid(TID.global.cartBarTotal)).toContainText(/2\s396/);
    await app.openCart();
    const line = app.tid(TID.cart.line('pz-pepperoni'));
    await expect(line).toContainText('35 см');
    await expect(line).toContainText('Сырный борт');
    await expect(line).toContainText('Бекон');
    await expect(app.tid(TID.cart.toFreeDelivery)).toContainText('Доставка бесплатно');
    await app.tap(TID.cart.lineInc('pz-pepperoni'));
    await expect(app.tid(TID.cart.qty('pz-pepperoni'))).toContainText('3');
    await expectUx(page, 'cart');

    // Promo: wrong code → error; ЖАР300 → −300 ₽.
    const total = rubles(await app.tid(TID.cart.total).innerText());
    await app.tap(TID.cart.promoRow);
    await app.fill(TID.cart.promoInput, 'НЕТТАКОГО');
    await app.tap(TID.cart.promoApply);
    await expect(app.tid(TID.cart.promoSheet)).toContainText('Такого промокода нет');
    await app.fill(TID.cart.promoInput, 'ЖАР300');
    await app.tap(TID.cart.promoApply);
    await app.expectToast('Промокод «ЖАР300» применён');
    await expect.poll(async () => rubles(await app.tid(TID.cart.total).innerText())).toBe(total - 300);
    await app.tap(TID.cart.promoRemove);
    await expect.poll(async () => rubles(await app.tid(TID.cart.total).innerText())).toBe(total);

    // Upsell adds a line; clearing empties the cart.
    await app.prefixed('cart-upsell-', app.cart.root).first().click();
    await expect(app.cart.all('cart-line-')).toHaveCount(2);
    await app.tap(TID.cart.clear);
    await app.tap(TID.cart.clearConfirm);
    await expect(app.cart.root).toContainText('В корзине пусто');
    await expect(app.cart.primaryCta).toHaveText('Открыть меню');
    await app.expectNoErrors();
  });

  test('feed «+» turns into a stepper; «−» at 1 removes the dish', async ({ app }) => {
    await app.open();
    const id = await app.addFromFeed();
    await expect(app.tid(TID.global.cartBar)).toBeVisible();
    await app.feed.getByTestId(TID.dishCard.qtyInc(id)).click();
    await expect(app.feed.getByTestId(TID.dishCard.qty(id))).toContainText('2');
    await app.feed.getByTestId(TID.dishCard.qtyDec(id)).click();
    await app.feed.getByTestId(TID.dishCard.qtyDec(id)).click();
    await expect(app.feed.getByTestId(TID.dishCard.add(id))).toBeVisible();
    await expect(app.tid(TID.global.cartBar)).toBeHidden();
  });

  test('menu filters narrow the list', async ({ app }) => {
    await app.open();
    await app.goTab('menu');
    const cards = app.menu.root.locator('[data-testid^="dish-card-"]');
    const all = await cards.count();
    await app.tap(TID.menu.filters);
    await app.tap(TID.menu.filter('veg'));
    await app.tap(TID.menu.filtersApply);
    await expect.poll(() => cards.count()).toBeLessThan(all);
    await expect(app.menu.root).toContainText('Вегетарианское');
  });

  // BUG (features/search/model/fuzzy.ts: searchDishes): category names are not indexed — «пицца» and the typo «пица»
  // return only the «Пятничный разнос» combo (its description mentions «пиццы»), none of the 12 pizzas.
  test.fail('search: «пица» (typo) finds pizzas', async ({ app }) => {
    await app.open();
    await app.tap(TID.home.search);
    await app.fill(TID.search.input, 'пица');
    await expect(app.search.root.getByTestId(TID.dishCard.card('pz-pepperoni'))).toBeVisible({ timeout: 3_000 });
  });

  test('search: typo «пеперони» finds the pizza; nonsense offers «Спросить у Шефа ИИ»', async ({ app, page }) => {
    await app.open();
    await app.tap(TID.home.search);
    await app.fill(TID.search.input, 'пеперони');
    await expect(app.search.root.getByTestId(TID.dishCard.card('pz-pepperoni'))).toBeVisible();
    await expectUx(page, 'search');
    await app.fill(TID.search.input, 'абырвалг');
    await expect(app.search.root).toContainText('Ничего не нашли по «абырвалг»');
    await expect(app.tid(TID.search.askAi)).toBeVisible();
    await app.tap(TID.search.clear);
    await app.tap(TID.search.popular('Пепперони'));
    await expect(app.search.root.getByTestId(TID.dishCard.card('pz-pepperoni'))).toBeVisible();
    // A result opens the dish card.
    await app.search.root.getByTestId(TID.dishCard.card('pz-pepperoni')).click();
    await app.dish.expectOpen();
  });

  test('address: pick a suggestion and save (logged in)', async ({ app, page }) => {
    await app.open({ loggedIn: true });
    await app.tap(TID.home.address);
    await app.address.expectOpen();
    await expect(app.tid(TID.address.zone)).toBeVisible();
    await expectUx(page, 'address');
    await app.tap(TID.address.primaryCta);
    await app.expectToast('Адрес сохранён');
  });
});
