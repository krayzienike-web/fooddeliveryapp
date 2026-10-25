/**
 * UI baseline per screen (visual regression + UX heuristics) in a deterministic state:
 * seed 1, clock started at Friday 23 Oct 2026 19:30 (Moscow), reducedMotion, persist off.
 * Baselines: tests/e2e/__screenshots__/screens.visual.spec.ts/<name>.png — re-baseline with `npm run e2e:update`.
 * Masked: `*-live` (ETA, kitchen, courier map), <video>, maps and the floor plan (see MASK).
 *
 * «Known UX debts»: for every screen with entries in support/known-issues.ts there is a `test.fail` that runs the
 * heuristics WITHOUT the ignores. When the app fixes them all, it "unexpectedly passes" → delete the entries.
 */
import { test, expect, TID, expectUx, expectScreen, collectUxViolations, KNOWN_UX, FRIDAY_EVENING, SUNDAY_NOON, waitForStill, type App } from '../support/fixtures';

/** Content that legitimately changes between runs (on top of *-live and <video>). */
const MASK = ['[data-testid="order-status-title"]', '[data-testid="restaurants-map"]', '[data-testid="restaurant-map"]', '[data-testid="qr-viewfinder"]', '[data-testid="address-screen"] svg'];

const loggedIn = { loggedIn: true };
const openRestaurant = async (a: App) => { await a.goTab('restaurants'); await a.tap(TID.restaurants.item('r-nevsky')); };

interface ScreenCase { name: string; ux: string; ready: string; flags?: Parameters<App['open']>[0]; go?: (a: App) => Promise<void>; now?: Date }

const SCREENS: ScreenCase[] = [
  { name: 'onboarding', ux: 'onboarding', ready: TID.onboarding.primaryCta, flags: { skipOnboarding: false } },
  { name: 'home-guest', ux: 'home', ready: TID.home.forYouList },
  { name: 'home-friday', ux: 'home', ready: TID.home.prediction, flags: loggedIn },
  { name: 'menu', ux: 'menu', ready: TID.menu.screen, go: (a) => a.goTab('menu') },
  { name: 'search', ux: 'search', ready: TID.search.popular('Пепперони'), go: (a) => a.tap(TID.home.search) },
  { name: 'search-results', ux: 'search', ready: 'dish-card-pz-pepperoni', go: async (a) => { await a.tap(TID.home.search); await a.fill(TID.search.input, 'пеперони'); } },
  { name: 'dish', ux: 'dish', ready: TID.dish.kbju, go: async (a) => { await a.goTab('menu'); await a.menu.root.getByTestId(TID.dishCard.card('pz-pepperoni')).click(); } },
  { name: 'cart', ux: 'cart', ready: TID.cart.total, go: async (a) => { await a.addFromFeed(); await a.openCart(); } },
  { name: 'cart-empty', ux: 'cart', ready: TID.cart.primaryCta, go: async (a) => { await a.addFromFeed(); await a.openCart(); await a.tap(TID.cart.clear); await a.tap(TID.cart.clearConfirm); } },
  { name: 'group-cart', ux: 'group-cart', ready: TID.groupCart.primaryCta, go: async (a) => { await a.addFromFeed(); await a.openCart(); await a.tap(TID.cart.groupInvite); } },
  { name: 'auth', ux: 'auth', ready: TID.auth.phoneInput, go: async (a) => { await a.goTab('profile'); await a.tap(TID.profile.login); } },
  { name: 'checkout', ux: 'checkout', ready: TID.checkout.primaryCta, flags: loggedIn, go: async (a) => { await a.addFromFeed(); await a.openCart(); await a.tap(TID.cart.primaryCta); } },
  { name: 'order', ux: 'order', ready: TID.order.kitchen, flags: { loggedIn: true, speed: 1 }, go: (a) => a.placeOrder() },
  { name: 'orders', ux: 'orders', ready: TID.orders.screen, flags: loggedIn, go: async (a) => { await a.goTab('profile'); await a.tap(TID.profile.orders); } },
  { name: 'address', ux: 'address', ready: TID.address.primaryCta, flags: loggedIn, go: (a) => a.tap(TID.home.address) },
  { name: 'assistant', ux: 'assistant', ready: TID.assistant.starter(3), go: (a) => a.goTab('assistant') },
  { name: 'assistant-set', ux: 'assistant', ready: TID.assistant.addAll, go: async (a) => { await a.goTab('assistant'); await a.tap(TID.assistant.starter(0)); } },
  // reels: no baseline while it opens on the end-of-feed footer (BUG in b2-reels.spec.ts) — it would lock the bug in.
  { name: 'restaurants', ux: 'restaurants', ready: TID.restaurants.item('r-nevsky'), go: (a) => a.goTab('restaurants') },
  { name: 'restaurant', ux: 'restaurant', ready: TID.restaurant.book, go: openRestaurant },
  { name: 'booking', ux: 'booking', ready: TID.booking.tableSummary, now: SUNDAY_NOON, go: async (a) => { await openRestaurant(a); await a.tap(TID.restaurant.book); await a.tap(TID.booking.date(1)); await a.tap(TID.booking.slot('19:00')); } },
  { name: 'banquet', ux: 'banquet', ready: TID.banquet.total, go: async (a) => { await a.goTab('restaurants'); await a.tap(TID.restaurants.banquet); } },
  { name: 'qr-menu', ux: 'qr-menu', ready: TID.qrMenu.pay, flags: loggedIn, go: async (a) => { await a.goTab('restaurants'); await a.tap(TID.restaurants.qr); await a.tap(TID.qrMenu.demoScan); } },
  { name: 'gift', ux: 'gift', ready: TID.gift.send, go: async (a) => { await a.goTab('restaurants'); await a.tap(TID.restaurants.gift); } },
  { name: 'profile', ux: 'profile', ready: TID.profile.loyalty, flags: loggedIn, go: (a) => a.goTab('profile') },
  { name: 'profile-guest', ux: 'profile', ready: TID.profile.login, go: (a) => a.goTab('profile') },
  { name: 'loyalty', ux: 'loyalty', ready: TID.loyalty.history, flags: loggedIn, go: async (a) => { await a.goTab('profile'); await a.tap(TID.profile.loyalty); } },
  { name: 'wheel', ux: 'wheel', ready: TID.wheel.spin, flags: loggedIn, go: async (a) => { await a.goTab('profile'); await a.tap(TID.profile.loyalty); await a.tap(TID.loyalty.wheel); } },
  { name: 'promos', ux: 'promos', ready: TID.promos.item('p-friday'), flags: loggedIn, go: async (a) => { await a.goTab('profile'); await a.tap(TID.profile.promos); } },
  { name: 'support', ux: 'support', ready: TID.support.human, flags: loggedIn, go: async (a) => { await a.goTab('profile'); await a.tap(TID.profile.help); } },
  { name: 'settings', ux: 'settings', ready: TID.settings.delete, flags: loggedIn, go: async (a) => { await a.goTab('profile'); await a.tap(TID.profile.settings); } },
  { name: 'director', ux: 'director', ready: TID.director.reset, go: (a) => a.openDirector() },
];

async function openCase(app: App, s: ScreenCase) {
  await app.open(s.flags ?? {}, { now: s.now ?? FRIDAY_EVENING });
  if (s.go) await s.go(app);
  await expect(app.tid(s.ready)).toBeVisible();
  await waitForStill(app.tid(s.ready).first());
}

test.describe('Screens · UI baseline', () => {
  for (const s of SCREENS) {
    test(`${s.name}: UX heuristics + screenshot`, async ({ app, page }) => {
      await openCase(app, s);
      await expectUx(page, s.ux, s.ux === 'director' ? { scope: '[data-testid="director-panel"]' } : {});
      await expectScreen(page, s.name, { mask: MASK.map((m) => page.locator(m)) });
      await app.expectNoErrors();
    });
  }
});

test.describe('Screens · known UX debts (expected to fail until fixed)', () => {
  const seen = new Set<string>();
  for (const s of SCREENS) {
    const debts = KNOWN_UX[s.ux];
    if (!debts?.length || seen.has(s.ux)) continue;
    seen.add(s.ux);
    test.fail(`${s.ux}: ${debts.map((d) => d.bug).join('; ')}`, async ({ app, page }) => {
      await openCase(app, s);
      const v = await collectUxViolations(page, { screen: s.ux, scope: s.ux === 'director' ? '[data-testid="director-panel"]' : undefined });
      expect(v).toEqual([]);
    });
  }
});
