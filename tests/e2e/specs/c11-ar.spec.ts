/**
 * C11 «AR / 3D»: блюдо в реальном размере — вращение, разбор на ингредиенты, размер пиццы, «на столе», в корзину.
 * Entry points: `dish-ar` chip on the Dish screen, `reels-ar` on Reels. reducedMotion (default flag) is REQUIRED:
 * without it the GL view auto-rotates and headless software GL drops to ~2 fps → clicks time out.
 * Headless Chromium has no camera → «На столе» falls back to the restaurant table with a hint.
 * Model geometry is unit-tested in src/features/ar/model/__tests__/models.test.ts.
 */
import { test, expect, TID, expectUx, expectScreen, waitForStill, type App } from '../support/fixtures';

const rubles = (s: string) => Number(s.replace(/\D/g, ''));
/**
 * While the GL view renders, headless software GL makes each animation frame slow, and Playwright's "stable"
 * actionability check (two equal frames) then takes 2–20 s per click. AR controls do not move, so skip it.
 */
const tapAr = async (app: App, id: string) => {
  await expect(app.tid(id)).toBeVisible();
  await app.tid(id).click({ force: true });
};

test.describe('C11 · AR', () => {
  // Own Playwright project (see playwright.config.ts): runs after the main suite, one test at a time.
  test.describe.configure({ mode: 'serial', timeout: 90_000 });
  test('dish → «На вашем столе» → size changes the price → explode → table mode → add 35 cm to the cart', async ({ app, page }) => {
    await app.open({ reducedMotion: true });
    await app.goTab('menu');
    await app.menu.root.getByTestId(TID.dishCard.card('pz-pepperoni')).click();
    await app.tap(TID.dish.ar);
    await app.ar.expectOpen();
    await expect(app.tid(TID.ar.view)).toBeVisible();

    const add = app.tid(TID.ar.add);
    await expect.poll(async () => rubles(await add.innerText())).toBe(690);
    await tapAr(app, TID.ar.size(25));
    await expect.poll(async () => rubles(await add.innerText())).toBe(530);
    await tapAr(app, TID.ar.size(35));
    await expect.poll(async () => rubles(await add.innerText())).toBe(910);

    await tapAr(app, TID.ar.explode);
    await expect(app.tid(TID.ar.ingredients)).toBeVisible();
    await tapAr(app, TID.ar.part(0));
    await expectUx(page, 'ar', { ignore: [`[data-testid="${TID.ar.view}"]`] });
    // Visual baseline lives here (not in screens.visual) so it runs in the isolated AR project; the GL canvas is masked.
    await waitForStill(app.tid(TID.ar.add));
    await expectScreen(page, 'ar-exploded', { mask: [page.getByTestId(TID.ar.view)] });

    await tapAr(app, `${TID.ar.mode}-table`);
    await expect(app.tid(TID.ar.tableHint)).toContainText('Камера недоступна');

    await tapAr(app, TID.ar.add);
    await app.dish.expectOpen();
    await app.tap(TID.dish.close);
    await app.openCart();
    await expect(app.tid(TID.cart.line('pz-pepperoni'))).toContainText('35 см');
    await expect(app.tid(TID.cart.line('pz-pepperoni'))).toContainText(/910/);
    await app.expectNoErrors();
  });

  test('drag on the 3D view rotates the model without leaving the screen', async ({ app }) => {
    await app.open({ reducedMotion: true });
    await app.navigate('AR', { dishId: 'bg-zhar' });
    await app.ar.expectOpen();
    const view = app.tid(TID.ar.view);
    const b = (await view.boundingBox())!;
    await app.swipe({ x: b.x + b.width * 0.3, y: b.y + b.height / 2 }, { x: b.x + b.width * 0.8, y: b.y + b.height / 2 });
    await expect(app.ar.root).toBeVisible();
    await expect(app.tid(TID.ar.size(30))).toHaveCount(0); // sizes are pizza-only
    await tapAr(app, TID.ar.back);
    await app.home.expectOpen();
  });
});
