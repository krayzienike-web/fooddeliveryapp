/**
 * App driver + page objects built on testIDs (react-native-web: testID → data-testid).
 *
 * The app is configured for tests through `window.__ZHAR_E2E__`, injected before the bundle loads
 * (read once at startup in src/shared/config/env.ts):
 *   seed            deterministic mock data (mock backend PRNG)
 *   speed           mock backend time multiplier (order lifecycle ≈ 135 s / speed)
 *   skipOnboarding  start on Home (taste profile not onboarded → «Самое популярное», no «почему» chips)
 *   loggedIn        start with a session for the demo user (+7 921 555-12-34, order history with Friday rituals)
 *   reducedMotion   reserved: the app does not read it yet; motion is calmed by `reducedMotion: 'reduce'` in the config
 *   persist         false → do not read/write AsyncStorage (clean state per test)
 * Any non-empty flag object also switches «Шеф ИИ» to the deterministic offline brain (src/services/ai/index.ts).
 *
 * DOM facts the helpers rely on:
 *  - stack screens below the top one stay mounted with `display: none` → `visible()` filters them out;
 *  - visited TAB screens stay mounted and count as "visible" for Playwright (translated off-screen),
 *    so ids that repeat across tabs (DishCard: dish-card-*, dish-add-*) must be scoped: `app.home.root.getByTestId(…)`.
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

/** Friday 23 Oct 2026, 19:30 Moscow — the demo user's «как обычно в пятницу» ritual window (J2). */
export const FRIDAY_EVENING = new Date('2026-10-23T19:30:00+03:00');

/** Console noise from third-party code that is not an app error. */
const IGNORED_CONSOLE = [/Download the React DevTools/i, /favicon/i];

/** Collects uncaught page errors and console.error so specs can assert a clean run. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !IGNORED_CONSOLE.some((r) => r.test(m.text()))) errors.push(`console.error: ${m.text()}`);
  });
  return errors;
}

/** Only rendered elements (drops stack screens kept mounted with display:none). */
export const visible = (l: Locator) => l.filter({ visible: true });

/** Base page object: `screen` is the testID prefix, e.g. new Screen(page, 'cart').el('total') → [data-testid="cart-total"]. */
export class Screen {
  constructor(readonly page: Page, readonly name: string) {}
  get root(): Locator { return visible(this.page.getByTestId(`${this.name}-screen`)); }
  get primaryCta(): Locator { return visible(this.page.getByTestId(`${this.name}-primary-cta`)); }
  el(element: string): Locator { return visible(this.page.getByTestId(`${this.name}-${element}`)); }
  /** Elements inside this screen whose testID starts with `prefix`. */
  all(prefix: string): Locator { return this.root.locator(`[data-testid^="${prefix}"]`); }
  async expectOpen(): Promise<void> { await expect(this.root).toBeVisible(); }
}

export class App {
  readonly errors: string[];
  constructor(readonly page: Page) {
    this.errors = trackErrors(page);
  }

  /** Opens the web export with the given E2E flags. Optional fixed clock (time keeps flowing from `now`). */
  async open(flags: E2EFlags = {}, opts: { now?: Date } = {}): Promise<void> {
    const f = { ...DEFAULT_FLAGS, ...flags };
    await this.page.addInitScript((v) => { (window as unknown as { __ZHAR_E2E__: unknown }).__ZHAR_E2E__ = v; }, f);
    if (opts.now) await this.page.clock.install({ time: opts.now });
    await this.page.goto('/');
    await expect(this.page.locator('[data-testid="home-screen"], [data-testid="onboarding-screen"]').first()).toBeVisible({ timeout: 30_000 });
  }

  /** Visible element by testID. */
  tid(id: string): Locator { return visible(this.page.getByTestId(id)); }
  /** Visible elements whose testID starts with `prefix` (scope with a screen root when ids repeat across tabs). */
  prefixed(prefix: string, scope?: Locator): Locator {
    return visible((scope ?? this.page.locator('body')).locator(`[data-testid^="${prefix}"]`));
  }
  async tap(id: string): Promise<void> { await this.tid(id).click(); }
  async fill(id: string, text: string): Promise<void> {
    const host = this.tid(id);
    // RN-web TextInput renders <input|textarea data-testid=…> directly; fall back to a nested input.
    const input = (await host.evaluate((el) => el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) ? host : host.locator('input,textarea').first();
    await input.fill(text);
  }
  /** testID → entity id, e.g. idOf('dish-add-pz-pepperoni', 'dish-add-') → 'pz-pepperoni'. */
  async idOf(l: Locator, prefix: string): Promise<string> {
    return ((await l.getAttribute('data-testid')) ?? '').slice(prefix.length);
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
  get groupCart() { return new Screen(this.page, 'group-cart'); }
  get auth() { return new Screen(this.page, 'auth'); }
  get checkout() { return new Screen(this.page, 'checkout'); }
  get address() { return new Screen(this.page, 'address'); }
  get order() { return new Screen(this.page, 'order'); }
  get orders() { return new Screen(this.page, 'orders'); }
  get rate() { return new Screen(this.page, 'rate'); }
  get support() { return new Screen(this.page, 'support'); }
  get assistant() { return new Screen(this.page, 'assistant'); }
  get wheel() { return new Screen(this.page, 'wheel'); }
  get restaurants() { return new Screen(this.page, 'restaurants'); }
  get restaurant() { return new Screen(this.page, 'restaurant'); }
  get booking() { return new Screen(this.page, 'booking'); }
  get banquet() { return new Screen(this.page, 'banquet'); }
  get profile() { return new Screen(this.page, 'profile'); }
  get qrMenu() { return new Screen(this.page, 'qr-menu'); }
  get gift() { return new Screen(this.page, 'gift'); }

  /** Personal feed on Home («Для вас»). */
  get feed(): Locator { return this.tid(TID.home.forYouList); }

  // ---- reusable flows (keep specs short; change here when a flow changes) ---------------------
  async goTab(tab: keyof typeof TID.global.tab): Promise<void> {
    await this.tap(TID.global.tab[tab]);
  }

  /** Adds the n-th dish of the Home feed via its «+» button; returns the dish id. */
  async addFromFeed(n = 0): Promise<string> {
    const add = this.prefixed('dish-add-', this.feed).nth(n);
    const id = await this.idOf(add, 'dish-add-');
    await add.click();
    await expect(this.feed.getByTestId(TID.dishCard.qty(id))).toBeVisible();
    return id;
  }

  async openCart(): Promise<void> {
    await this.tap(TID.global.cartBarOpen);
    await this.cart.expectOpen();
  }

  /** SMS login with the test code. Called when checkout asks for auth (code auto-submits on the 4th digit). */
  async loginWithSms(phone = '9990000000', code = '0000'): Promise<void> {
    await this.auth.expectOpen();
    await this.fill(TID.auth.phoneInput, phone);
    await this.tap(TID.auth.primaryCta);
    await expect(this.page.getByTestId(TID.auth.codeInput)).toBeAttached();
    await this.page.getByTestId(TID.auth.codeInput).fill(code);
  }

  /**
   * Finger swipe via CDP touch events. react-native-gesture-handler pans on the web export do NOT react to
   * Playwright mouse drags on this (hasTouch) device profile, only to touch input.
   */
  async swipe(from: { x: number; y: number }, to: { x: number; y: number }, steps = 24): Promise<void> {
    const cdp = await this.page.context().newCDPSession(this.page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
    for (let i = 1; i <= steps; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }] });
      await this.page.waitForTimeout(16); // one frame: the pan needs frame-paced moves to activate and track
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  }

  /** Finger tap at a relative point of an element (e.g. a Slider track: 0 = min, 1 = max). */
  async touchTap(l: Locator, fx = 0.5, fy = 0.5): Promise<void> {
    await l.scrollIntoViewIfNeeded();
    const b = await l.boundingBox();
    if (!b) throw new Error('touchTap: element is not visible');
    const p = { x: b.x + b.width * fx, y: b.y + b.height * fy };
    await this.swipe(p, { x: p.x + 1, y: p.y }, 2);
  }

  /** Swipes the top onboarding card (no testID yet — it sits in the viewport centre). */
  async swipeTasteCard(like: boolean): Promise<void> {
    const vp = this.page.viewportSize()!;
    const c = { x: vp.width / 2, y: vp.height / 2 };
    await this.swipe(c, { x: c.x + (like ? 240 : -240), y: c.y });
  }

  /** Real finger drag of the SlideToPay thumb (C3). Releasing before 86 % of the track must NOT pay. */
  async slideToPay(share = 1): Promise<void> {
    const box = await this.tid(TID.checkout.primaryCta).boundingBox();
    if (!box) throw new Error('slide-to-pay is not visible');
    const y = box.y + box.height / 2;
    const x0 = box.x + 4 + 24; // thumb centre
    await this.swipe({ x: x0, y }, { x: x0 + (box.width - 48 - 8) * share, y });
  }

  /** Cart → checkout (logging in if asked) → pay → order screen. */
  async checkoutAndPay(opts: { payment?: string; slide?: boolean } = {}): Promise<void> {
    await this.tap(TID.cart.primaryCta);
    await expect(this.auth.root.or(this.checkout.root)).toBeVisible();
    if (await this.auth.root.isVisible()) await this.loginWithSms();
    await this.checkout.expectOpen();
    if (opts.payment) {
      await this.tap(TID.checkout.payment);
      await this.tap(TID.checkout.paymentMethod(opts.payment));
      await expect(this.page.getByTestId(TID.checkout.paymentMethod(opts.payment))).toBeHidden();
    }
    if (opts.slide) await this.slideToPay();
    else await this.tap(TID.checkout.primaryCta);
    await this.order.expectOpen();
  }

  /** Home → add the first feed dish → cart → pay. Lands on the order screen. */
  async placeOrder(opts: { pickup?: boolean; payment?: string } = {}): Promise<void> {
    await this.home.expectOpen();
    if (opts.pickup) await this.tap(TID.home.modePickup);
    await this.addFromFeed();
    await this.openCart();
    await this.checkoutAndPay({ payment: opts.payment });
    // the «Заказ принят!» overlay covers the screen for ~1.6 s
    await expect(this.page.getByText('Заказ принят!')).toBeHidden({ timeout: 5_000 });
  }

  async expectStatus(re: RegExp | string, timeout = 30_000): Promise<void> {
    await expect(this.tid(TID.order.statusTitle)).toHaveText(re, { timeout });
  }

  /** Opens the director panel (D0): Home tab → triple tap on the logo. */
  async openDirector(): Promise<void> {
    if (!(await this.home.root.isVisible())) await this.goTab('home');
    const logo = this.tid(TID.home.logo);
    for (let i = 0; i < 3; i++) await logo.click({ delay: 10 });
    await expect(this.tid(TID.director.panel)).toBeVisible();
  }

  async closeDirector(): Promise<void> {
    // No close button (NEEDS testID `director-close`): tap the backdrop above the sheet.
    await this.page.mouse.click(20, 80);
    await expect(this.tid(TID.director.panel)).toBeHidden();
  }

  /** Fires an incident on the active order through the director panel. Returns the toast text if the app refused. */
  async triggerIncident(kind: string): Promise<void> {
    await this.openDirector();
    await this.tap(TID.director.incident(kind));
  }

  async expectToast(re: RegExp | string): Promise<void> {
    await expect(this.tid(TID.global.toast)).toContainText(re);
  }

  async expectNoErrors(): Promise<void> {
    expect(this.errors, this.errors.join('\n')).toEqual([]);
  }
}
