/** Self-test of the UX heuristics checker on synthetic markup (does not depend on the app). */
import { test, expect, collectUxViolations } from '../support/fixtures';

const html = (body: string) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;background:#111;color:#fff;font:16px sans-serif} .b{display:block;width:200px;height:48px}</style></head><body>${body}</body></html>`;

test('passes a clean screen', async ({ page }) => {
  await page.setContent(html(`
    <div data-testid="cart-screen">
      <span data-testid="cart-total">1 990 ₽</span>
      <button class="b" data-testid="cart-primary-cta">Оформить</button>
      <button class="b" data-testid="cart-promo-apply">Применить</button>
    </div>`));
  expect(await collectUxViolations(page)).toEqual([]);
});

test('flags two primary CTAs', async ({ page }) => {
  await page.setContent(html(`<button class="b" data-testid="a-primary-cta">A</button><button class="b" data-testid="b-primary-cta">B</button>`));
  const v = await collectUxViolations(page, { checks: ['primaryCta'] });
  expect(v).toHaveLength(1);
  expect(v[0].detail).toContain('2 primary CTAs');
});

test('ignores hidden primary CTA', async ({ page }) => {
  await page.setContent(html(`<button class="b" data-testid="a-primary-cta">A</button><button class="b" style="display:none" data-testid="b-primary-cta">B</button>`));
  expect(await collectUxViolations(page, { checks: ['primaryCta'] })).toEqual([]);
});

test('flags small tap targets (RN-web Pressable = div[tabindex=0])', async ({ page }) => {
  await page.setContent(html(`<div tabindex="0" data-testid="dish-qty-inc" style="width:32px;height:32px">+</div>`));
  const v = await collectUxViolations(page, { checks: ['tapTargets'] });
  expect(v.map((x) => x.testId)).toEqual(['dish-qty-inc']);
});

test('data-ux-ignore opts out', async ({ page }) => {
  await page.setContent(html(`<div data-ux-ignore="tap"><div tabindex="0" data-testid="x" style="width:10px;height:10px">x</div></div>`));
  expect(await collectUxViolations(page, { checks: ['tapTargets'] })).toEqual([]);
});

test('flags interactive elements without testID', async ({ page }) => {
  await page.setContent(html(`<button class="b">Без testID</button>`));
  expect((await collectUxViolations(page, { checks: ['testIds'] }))[0].check).toBe('testIds');
});

test('flags horizontal overflow but not horizontal scrollers', async ({ page }) => {
  await page.setContent(html(`<div style="overflow-x:auto"><div style="width:900px;height:10px"></div></div>`));
  expect(await collectUxViolations(page, { checks: ['overflow'] })).toEqual([]);
  await page.setContent(html(`<div data-testid="home-banner" style="width:600px;height:10px"></div>`));
  const v = await collectUxViolations(page, { checks: ['overflow'] });
  expect(v.length).toBeGreaterThan(0);
});

test('flags low text contrast on tagged elements only', async ({ page }) => {
  await page.setContent(html(`
    <div style="background:#111"><span data-testid="dish-price" style="color:#333">590 ₽</span></div>
    <div style="background:#111"><span style="color:#333">untagged</span></div>
    <div style="background:#111"><span data-testid="dish-title" style="color:#eee">Пицца</span></div>`));
  const v = await collectUxViolations(page, { checks: ['contrast'] });
  expect(v.map((x) => x.testId)).toEqual(['dish-price']);
});

test('large text uses the 3:1 threshold', async ({ page }) => {
  // #767676 on #fff ≈ 4.54 ; #949494 on #fff ≈ 3.03 → ok for 24px, fails for 16px
  await page.setContent(html(`<div style="background:#fff">
    <span data-testid="a-title" style="color:#949494;font-size:24px">Big</span>
    <span data-testid="b-title" style="color:#949494;font-size:16px">Small</span></div>`));
  const v = await collectUxViolations(page, { checks: ['contrast'] });
  expect(v.map((x) => x.testId)).toEqual(['b-title']);
});
