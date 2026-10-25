/**
 * Visual-regression helper. Baselines live in tests/e2e/__screenshots__/<spec>/<name>.png
 * (see snapshotPathTemplate in playwright.config.ts). Re-baseline with `npm run e2e:update`.
 *
 * Stabilisation: waits for fonts and images, hides caret, disables CSS animations,
 * and masks anything time-dependent (data-testid ending in "-live": timers, maps, video, ETA).
 * JS-driven animations (Reanimated) are stabilised by the app honouring prefers-reduced-motion
 * (config sets reducedMotion: 'reduce') and the E2E flag `__ZHAR_E2E__.reducedMotion`.
 */
import { expect, type Locator, type Page } from '@playwright/test';

export const LIVE_SELECTOR = '[data-testid$="-live"], video';

export interface ScreenshotOptions {
  /** Extra locators to mask (dynamic content). */
  mask?: Locator[];
  /** Allowed share of differing pixels (default from config: 0.02). */
  maxDiffPixelRatio?: number;
  fullPage?: boolean;
}

export async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts?.ready;
    // Only images in the viewport: off-screen lazy images never load. Cap the wait so a stuck image cannot hang the test.
    const inView = (i: HTMLImageElement) => { const r = i.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
    const pending = [...document.images].filter((i) => !i.complete && inView(i)).map((i) => new Promise((r) => { i.addEventListener('load', r); i.addEventListener('error', r); }));
    await Promise.race([Promise.all(pending), new Promise((r) => setTimeout(r, 5000))]);
  });
  // two frames so layout/fade-ins settle
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** `await expectScreen(page, 'cart-with-promo')` */
export async function expectScreen(page: Page, name: string, opts: ScreenshotOptions = {}): Promise<void> {
  await settle(page);
  await expect(page).toHaveScreenshot(`${name}.png`, {
    mask: [page.locator(LIVE_SELECTOR), ...(opts.mask ?? [])],
    maskColor: '#FF00FF',
    fullPage: opts.fullPage ?? false,
    ...(opts.maxDiffPixelRatio !== undefined ? { maxDiffPixelRatio: opts.maxDiffPixelRatio } : {}),
  });
}

/**
 * Waits until an element has finished its entering animation: not fully transparent, and opacity + box stable
 * between two polls (a disabled button legitimately stays at 0.45). Reanimated entering/appear animations still run briefly under reduced motion, and the UX
 * checker treats a transparent ancestor as "hidden".
 */
export async function waitForStill(l: Locator, timeout = 5_000): Promise<void> {
  let last = '';
  await expect
    .poll(
      async () => {
        const s = await l.evaluate((el) => {
          let o = 1;
          for (let p: Element | null = el; p; p = p.parentElement) o *= Number(getComputedStyle(p).opacity);
          if (o === 0) return 'fading';
          const r = el.getBoundingClientRect();
          return `${o.toFixed(3)}@${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`;
        });
        const still = s !== 'fading' && s === last;
        last = s;
        return still;
      },
      { timeout, intervals: [100] },
    )
    .toBe(true);
}
