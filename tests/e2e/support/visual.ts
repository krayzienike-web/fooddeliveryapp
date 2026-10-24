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
    await Promise.all(
      [...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; })),
    );
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
