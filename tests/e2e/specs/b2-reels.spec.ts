/**
 * B2 «Food Reels»: вертикальная лента видео как готовим; «+» прямо с видео, карточка блюда, лайк.
 * Each rendered reel repeats the same testIDs (FlatList renders 2–3 items) → `.first()` is the active one.
 * NEEDS testID: `reels-item-<dishId>` per reel (see support/known-issues.ts).
 */
import { test, expect, TID, expectUx } from '../support/fixtures';

test.describe('B2 · Food Reels', () => {
  test('open from Home → video/poster → like → «+» → badge → dish card → close', async ({ app, page }) => {
    await app.open();
    await app.tap(TID.home.reelsEntry);
    await app.reels.expectOpen();
    await expect(app.reels.root).toContainText('Смотреть, как готовим');
    // Real video for some reels, Ken Burns poster for the rest; at least one media element is rendered.
    await expect(app.reels.root.locator('video, img').first()).toBeAttached();
    await expect(app.tid(TID.global.orderCapsule)).toHaveCount(0);
    await expectUx(page, 'reels');

    const card = app.tid(TID.reels.dishCard).first();
    const dishName = (await card.innerText()).split('\n')[0];
    await app.tid(TID.reels.like).first().click();
    await app.tid(TID.reels.add).first().click();
    await expect(app.tid(TID.reels.cart)).toContainText('1');

    await app.tid(TID.reels.dishOpen).first().click();
    await app.dish.expectOpen();
    await expect(app.tid(TID.dish.title)).toHaveText(dishName);
    await app.tap(TID.dish.close);
    await app.reels.expectOpen();

    await app.tap(TID.reels.cart);
    await app.cart.expectOpen();
    await expect(app.cart.all('cart-line-')).toHaveCount(1);
    await app.tap(TID.cart.close);
    await app.tap(TID.reels.close);
    await app.home.expectOpen();
    await app.expectNoErrors();
  });

  // BUG (ReelsScreen.tsx, web export): the feed opens scrolled to the very end — the FlatList scroller starts at
  // scrollTop ≈ 17 × screen height and the guest sees only the «Вы посмотрели всё новое» footer (first reel is above
  // the viewport). Repro: Home → «Смотреть, как готовим». Expected: the first reel fills the screen.
  test.fail('opens on the first reel', async ({ app, page }) => {
    await app.open();
    await app.tap(TID.home.reelsEntry);
    await app.reels.expectOpen();
    await expect(page.getByText('Вы посмотрели всё новое')).not.toBeInViewport({ timeout: 3_000 });
    await expect(app.tid(TID.reels.dishCard).first()).toBeInViewport({ timeout: 3_000 });
  });

  // Blocked by the bug above (the list starts at its end, so there is no «next» reel to swipe to).
  test.fixme('swipe up shows the next dish', async ({ app, page }) => {
    await app.open();
    await app.tap(TID.home.reelsEntry);
    const first = (await app.tid(TID.reels.dishCard).first().innerText()).split('\n')[0];
    const vp = page.viewportSize()!;
    await app.swipe({ x: vp.width / 2, y: vp.height * 0.7 }, { x: vp.width / 2, y: vp.height * 0.1 }, 16);
    await expect(app.tid(TID.reels.dishCard).first()).not.toContainText(first);
  });
});
