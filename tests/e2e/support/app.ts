/**
 * App driver + page objects built on testIDs (react-native-web: testID → data-testid).
 *
 * The app is configured for tests through `window.__ZHAR_E2E__`, injected before the bundle loads.
 * The lead's code should read it once at startup (see docs/testing.md → "E2E hooks"):
 *   seed            deterministic mock data / recommendations
 *   speed           mock backend time multiplier (order lifecycle)
 *   skipOnboarding  start on Home with a neutral taste profile
 *   loggedIn        start with a session for the demo user (skip SMS)
 *   reducedMotion   disable Reanimated/Lottie loops for stable screenshots
 *   persist         false → do not read/write AsyncStorage (clean state per test)
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { TID } from './testids';

export interface E2EFlags {
  seed?: number;
  speed?: number;
  skipOnboarding?: boolean;
  loggedIn?: boolean;
  reducedMotion?: boolean;
  persist?: boolean;
}

export const DEFAULT_FLAGS: E2EFlags = { seed: 1, speed: 20, skipOnboarding: true, loggedIn: false, reducedMotion: true, persist: false };

/** Collects uncaught page errors and console.error so specs can assert a clean run. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  return errors;
}

/** Base page object: `screen` is the testID prefix, e.g. new Screen(page, 'cart').el('total') → [data-testid="cart-total"]. */
export class Screen {
  constructor(readonly page: Page, readonly name: string) {}
  get root(): Locator { return this.page.getByTestId(`${this.name}-screen`); }
  get primaryCta(): Locator { return this.page.getByTestId(`${this.name}-primary-cta`); }
  el(element: string): Locator { return this.page.getByTestId(`${this.name}-${element}`); }
  async expectOpen(): Promise<void> { await expect(this.root).toBeVisible(); }
}

export class App {
  readonly errors: string[];
  constructor(readonly page: Page) {
    this.errors = trackErrors(page);
  }

  /** Opens the web export with the given E2E flags. Optional fixed clock (e.g. "Friday 19:30" for J2). */
  async open(flags: E2EFlags = {}, opts: { now?: Date } = {}): Promise<void> {
    const f = { ...DEFAULT_FLAGS, ...flags };
    await this.page.addInitScript((v) => { (window as unknown as { __ZHAR_E2E__: unknown }).__ZHAR_E2E__ = v; }, f);
    if (opts.now) await this.page.clock.install({ time: opts.now });
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  tid(id: string): Locator { return this.page.getByTestId(id); }
  async tap(id: string): Promise<void> { await this.tid(id).click(); }
  async fill(id: string, text: string): Promise<void> {
    const host = this.tid(id);
    // RN-web TextInput renders <input data-testid=…> directly; fall back to a nested input.
    const input = (await host.evaluate((el) => el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) ? host : host.locator('input,textarea').first();
    await input.fill(text);
  }

  screen(name: string): Screen { return new Screen(this.page, name); }

  // ---- page objects -------------------------------------------------------------------------
  get onboarding() { return new Screen(this.page, 'onboarding'); }
  get home() { return new Screen(this.page, 'home'); }
  get reels() { return new Screen(this.page, 'reels'); }
  get menu() { return new Screen(this.page, 'menu'); }
  get search() { return new Screen(this.page, 'search'); }
  get dish() { return new Screen(this.page, 'dish'); }
  get cart() { return new Screen(this.page, 'cart'); }
  get auth() { return new Screen(this.page, 'auth'); }
  get checkout() { return new Screen(this.page, 'checkout'); }
  get order() { return new Screen(this.page, 'order'); }
  get wheel() { return new Screen(this.page, 'wheel'); }
  get assistant() { return new Screen(this.page, 'assistant'); }
  get restaurants() { return new Screen(this.page, 'restaurants'); }
  get restaurant() { return new Screen(this.page, 'restaurant'); }
  get booking() { return new Screen(this.page, 'booking'); }
  get banquet() { return new Screen(this.page, 'banquet'); }
  get profile() { return new Screen(this.page, 'profile'); }
  get director() { return new Screen(this.page, 'director'); }

  // ---- reusable flows (keep specs short; change here when a flow changes) ---------------------
  async goTab(tab: keyof typeof TID.global.tab): Promise<void> {
    await this.tap(TID.global.tab[tab]);
  }

  async openCart(): Promise<void> {
    await this.tap(TID.global.cartBarOpen);
    await this.cart.expectOpen();
  }

  /** SMS login with the test code. Called when checkout asks for auth. */
  async loginWithSms(phone = '9990000000', code = '0000'): Promise<void> {
    await this.auth.expectOpen();
    await this.fill(TID.auth.phoneInput, phone);
    await this.tap(TID.auth.primaryCta);
    await this.fill(TID.auth.codeInput, code);
  }

  /** Cart → checkout (logging in if asked) → pay → order screen. */
  async checkoutAndPay(opts: { payment?: string } = {}): Promise<void> {
    await this.tap(TID.cart.primaryCta);
    if (await this.auth.root.isVisible().catch(() => false)) await this.loginWithSms();
    await this.checkout.expectOpen();
    if (opts.payment) await this.tap(TID.checkout.payment(opts.payment));
    await this.tap(TID.checkout.primaryCta);
    await this.order.expectOpen();
  }

  /** Opens the director panel (D0) from the profile. */
  async openDirector(): Promise<void> {
    await this.goTab('profile');
    await this.tap(TID.profile.director);
    await this.director.expectOpen();
  }

  async expectNoErrors(): Promise<void> {
    expect(this.errors, this.errors.join('\n')).toEqual([]);
  }
}
