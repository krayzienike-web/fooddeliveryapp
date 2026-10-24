/**
 * UI baseline per screen (visual regression + UX heuristics) in a deterministic state.
 * One entry per screen; extend SCREENS when a screen is added. Baselines: tests/e2e/__screenshots__/.
 * Remove `.fixme` for a screen as soon as its root testID `<screen>-screen` exists.
 */
import { test, TID, expectGoodUx, expectScreen } from '../support/fixtures';
import type { App } from '../support/app';

const SCREENS: Array<{ name: string; open: (app: App) => Promise<void>; ready: string }> = [
  { name: 'onboarding', ready: TID.onboarding.screen, open: (a) => a.open({ skipOnboarding: false }) },
  { name: 'home', ready: TID.home.screen, open: (a) => a.open() },
  { name: 'menu', ready: TID.menu.screen, open: async (a) => { await a.open(); await a.goTab('menu'); } },
  { name: 'search', ready: TID.search.screen, open: async (a) => { await a.open(); await a.tap(TID.home.search); await a.fill(TID.search.input, 'пица'); } },
  { name: 'dish', ready: TID.dish.screen, open: async (a) => { await a.open(); await a.page.locator('[data-testid^="home-dish-card-"]').first().click(); } },
  { name: 'cart', ready: TID.cart.screen, open: async (a) => { await a.open(); await a.page.locator('[data-testid^="home-dish-add-"]').first().click(); await a.openCart(); } },
  { name: 'auth', ready: TID.auth.screen, open: async (a) => { await a.open(); await a.goTab('profile'); await a.tap(TID.profile.login); } },
  { name: 'assistant', ready: TID.assistant.screen, open: async (a) => { await a.open(); await a.goTab('assistant'); } },
  { name: 'restaurants', ready: TID.restaurants.screen, open: async (a) => { await a.open(); await a.goTab('restaurants'); } },
  { name: 'profile', ready: TID.profile.screen, open: async (a) => { await a.open({ loggedIn: true }); await a.goTab('profile'); } },
  { name: 'director', ready: TID.director.screen, open: async (a) => { await a.open({ loggedIn: true }); await a.openDirector(); } },
];

test.describe('Screens · UI baseline', () => {
  for (const s of SCREENS) {
    test.fixme(`${s.name}: UX heuristics + screenshot`, async ({ app, page }) => {
      await s.open(app);
      await app.tid(s.ready).waitFor();
      await expectGoodUx(page, { screen: s.name });
      await expectScreen(page, s.name);
      await app.expectNoErrors();
    });
  }
});
