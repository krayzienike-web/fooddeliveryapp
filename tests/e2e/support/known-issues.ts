/**
 * Known UX debts found by the UX heuristics (tests/e2e/support/ux.ts) that cannot be fixed from tests/.
 * Every entry is excluded from `expectGoodUx` via `ignore` so the rest of the screen stays guarded, AND has a
 * `test.fail` in screens.visual.spec.ts («Known UX bugs») — when the app fixes it, that test "unexpectedly passes":
 * delete the entry here and the matching row in docs/testing.md.
 */
export interface KnownUx {
  /** CSS selector of the offending element (or its host). */
  selector: string;
  check: 'tapTargets' | 'testIds' | 'overflow';
  /** Human-readable bug, also used as the test title. */
  bug: string;
}

export const KNOWN_UX: Record<string, KnownUx[]> = {
  home: [
    // BUG (HomeScreen.tsx): logo is a 73×26 Pressable (hidden director gesture) → tap target < 48 dp.
    { selector: '[data-testid="home-logo"]', check: 'tapTargets', bug: 'home-logo tap target is 73×26' },
    // BUG (shared/ui/Segmented.tsx): segments are 40 dp tall inside a 48 dp track (padding 4) → < 48 dp.
    { selector: '[data-testid="home-mode"]', check: 'tapTargets', bug: 'home-mode segments are 40 dp tall' },
  ],
  dish: [
    // BUG (DishScreen.tsx): «400 г · 310 ккал ▾» toggle has minHeight 32.
    { selector: '[data-testid="dish-kbju"]', check: 'tapTargets', bug: 'dish-kbju toggle is 32 dp tall' },
    // Same Segmented debt as home-mode (pizza size).
    { selector: '[data-testid^="dish-group-"]', check: 'tapTargets', bug: 'dish modifier segments are 40 dp tall' },
  ],
  search: [
    // BUG (SearchScreen.tsx): the <TextInput> is 24 dp tall inside a 48 dp pill; taps on the pill outside the text do not focus it.
    { selector: '[data-testid="search-input"]', check: 'tapTargets', bug: 'search-input is 24 dp tall' },
    // NEEDS testID (SearchScreen.tsx): «Недавние» chips → `search-recent-<query>`.
    { selector: '[data-testid="search-screen"] [role="button"]:not([data-testid])', check: 'testIds', bug: 'search recent chips have no testID' },
  ],
  assistant: [
    // BUG (AssistantScreen.tsx): composer input is 40 dp tall, send button 44×44.
    { selector: '[data-testid="assistant-input"]', check: 'tapTargets', bug: 'assistant-input is 40 dp tall' },
    { selector: '[data-testid="assistant-send"]', check: 'tapTargets', bug: 'assistant-send is 44×44' },
  ],
  reels: [
    // NEEDS testID (ReelsScreen.tsx): full-screen double-tap Pressable of every reel → `reels-item-<dishId>`.
    { selector: '[data-testid="reels-screen"] [aria-label="Двойной тап — в избранное"]', check: 'testIds', bug: 'reel items have no testID' },
  ],
  rate: [
    // NEEDS testID (RateScreen.tsx): close button → `rate-close`; reason chips → `rate-tag-<n>`.
    { selector: '[data-testid="rate-screen"] [role="button"]:not([data-testid])', check: 'testIds', bug: 'rate close button and reason chips have no testID' },
  ],
  support: [
    // BUG (SupportScreen.tsx): the composer row is 477 px wide on a 412 px screen — input and «send» are cut off.
    { selector: '[data-testid="support-input"], [data-testid="support-send"]', check: 'overflow', bug: 'support composer overflows the screen (477 px > 412 px)' },
  ],
  address: [
    // BUG (AddressScreen.tsx): intercom and comment inputs are 21 dp tall.
    { selector: '[data-testid="address-intercom"], [data-testid="address-comment"]', check: 'tapTargets', bug: 'address intercom/comment inputs are 21 dp tall' },
    // NEEDS testID (AddressScreen.tsx): label chips «Дом / Работа / Друзья» → `address-label-<label>`.
    { selector: '[data-testid="address-screen"] [role="button"]:not([data-testid])', check: 'testIds', bug: 'address label chips have no testID' },
  ],
  director: [
    // Presenter-only tooling, but still: «Пн…Сб» and «×1…×8» chips are 38–43 dp wide; «Сейчас» and theme chips have no testID
    // (NEEDS testID: `director-now`, `director-theme-<dark|light|system>`).
    { selector: '[data-testid="director-panel"] [role="button"]', check: 'tapTargets', bug: 'director day/speed chips are narrower than 48 dp' },
    { selector: '[data-testid="director-panel"] [role="button"]:not([data-testid])', check: 'testIds', bug: 'director «Сейчас» and theme chips have no testID' },
  ],
  restaurants: [
    // BUG (shared/ui/Segmented.tsx, same as home-mode): «Списком / На карте» segments are 40 dp tall.
    { selector: '[data-testid="restaurants-view"]', check: 'tapTargets', bug: 'restaurants-view segments are 40 dp tall' },
  ],
  restaurant: [
    // BUG (RestaurantScreen.tsx): feature chips («Завтраки с 9:00», «Окна на Невский»…) are shared/ui Chip without onPress —
    // announced as buttons (role=button, focusable) but do nothing and have no testID. Use a non-interactive tag instead.
    { selector: '[data-testid="restaurant-screen"] [role="button"]:not([data-testid])', check: 'testIds', bug: 'restaurant feature chips are fake buttons without testID' },
  ],
  booking: [
    // BUG (widgets/floor-plan/FloorPlanView.tsx): tables are drawn to scale — 2-seat and bar tables are 30–46 dp (< 48).
    // The «Подобрали стол» auto-pick makes the plan optional, but direct taps on small tables are hard.
    { selector: '[data-testid="booking-floor-plan"]', check: 'tapTargets', bug: 'floor-plan tables are smaller than 48 dp' },
  ],
  banquet: [
    // Same Segmented debt as home-mode.
    { selector: '[data-testid="banquet-format"]', check: 'tapTargets', bug: 'banquet-format segments are 40 dp tall' },
    // BUG (shared/ui/Slider.tsx): the slider touch area is 44 dp tall (style height 44).
    { selector: '[data-testid="banquet-guests"], [data-testid="banquet-budget"]', check: 'tapTargets', bug: 'banquet sliders are 44 dp tall' },
  ],
  'qr-menu': [
    { selector: '[data-testid="qr-split-mode"]', check: 'tapTargets', bug: 'qr-split-mode segments are 40 dp tall' },
    // BUG (shared/ui/Chip.tsx): no minWidth — a short label («5%») gives a 45 dp wide chip (same root cause as director chips).
    { selector: '[data-testid="qr-tips-5"]', check: 'tapTargets', bug: 'qr-tips-5 chip is 45 dp wide' },
  ],
  settings: [
    // Segmented debt (theme) + Chip width debt («ПП») as elsewhere.
    { selector: '[data-testid="settings-theme"]', check: 'tapTargets', bug: 'settings-theme segments are 40 dp tall' },
    { selector: '[data-testid="settings-diet-pp"]', check: 'tapTargets', bug: 'settings-diet-pp chip is 45 dp wide' },
    // BUG (SettingsScreen.tsx Toggle): the testID sits on the RN <Switch>, rendered as a 40×20 input; only that
    // small switch is the tap target (the row title is not pressable).
    { selector: '[data-testid="settings-screen"] [role="switch"]', check: 'tapTargets', bug: 'settings switches are 40×20 tap targets' },
  ],
  ar: [
    { selector: '[data-testid="ar-mode"]', check: 'tapTargets', bug: 'ar-mode segments are 40 dp tall' },
  ],
  global: [
    // NEEDS testID (shared/ui/Sheet.tsx): every sheet's backdrop is a Pressable «Закрыть» without testID
    // (suggested `<sheet testID>-backdrop`, e.g. `director-panel-backdrop`).
    { selector: '[aria-label="Закрыть"]:not([data-testid])', check: 'testIds', bug: 'sheet backdrops have no testID' },
    // BUG (OrderCapsule.tsx): the status capsule is 40 dp tall when collapsed.
    { selector: '[data-testid="order-capsule"]', check: 'tapTargets', bug: 'order-capsule is 40 dp tall' },
  ],
};

/** `ignore` selectors for expectGoodUx on a screen (includes global chrome debts). */
export const knownUxIgnore = (screen: string): string[] => [...(KNOWN_UX[screen] ?? []), ...KNOWN_UX.global].map((k) => k.selector);
