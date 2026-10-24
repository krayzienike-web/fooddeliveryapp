/**
 * Single source of truth for testIDs used by E2E specs (mirrored in docs/testing.md).
 *
 * Convention: kebab-case `screen-element[-qualifier]`.
 *  - `<screen>-screen`        root container of every screen (used to wait for navigation)
 *  - `<screen>-primary-cta`   THE main action of the screen (UX rule: at most one visible at a time)
 *  - `<screen>-<element>-<id>` items of lists; `<id>` is the entity id (dish id, table id …), made kebab-safe by `kebab()`
 *  - `*-live`                 elements whose content changes over time (timers, maps, video) — masked in screenshots
 * react-native-web renders `testID` as `data-testid`.
 *
 * When a screen changes: update this file first, then the page object / spec, then docs/testing.md.
 */

/** Makes an arbitrary id safe for a testID: "19:00" → "19-00", "Pizza_1" → "pizza-1". */
export const kebab = (s: string | number) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-|-$/g, '');

const item = (prefix: string) => (id: string | number) => `${prefix}-${kebab(id)}`;

export const TID = {
  /** Global chrome, visible on many screens. */
  global: {
    tab: { home: 'tabbar-home', menu: 'tabbar-menu', assistant: 'tabbar-assistant', restaurants: 'tabbar-restaurants', profile: 'tabbar-profile' },
    cartBar: 'cart-bar',
    cartBarTotal: 'cart-bar-total',
    cartBarOpen: 'cart-bar-open',
    orderCapsule: 'order-capsule',
    orderCapsuleStatus: 'order-capsule-status',
    toast: 'toast',
    back: 'header-back',
  },
  onboarding: {
    screen: 'onboarding-screen',
    option: item('onboarding-option'), // taste-DNA choice (axis or dish id)
    progress: 'onboarding-progress',
    skip: 'onboarding-skip',
    primaryCta: 'onboarding-primary-cta', // «Дальше» / «Готово»
  },
  home: {
    screen: 'home-screen',
    modeDelivery: 'home-mode-delivery',
    modePickup: 'home-mode-pickup',
    address: 'home-address',
    search: 'home-search',
    forYouList: 'home-for-you-list',
    dishCard: item('home-dish-card'),
    dishAdd: item('home-dish-add'),
    dishWhy: item('home-dish-why'),
    category: item('home-category'),
    promo: item('home-promo'),
    reelsEntry: 'home-reels-entry',
    prediction: 'home-prediction-card', // D2: at most one
    predictionWhy: 'home-prediction-why',
    predictionMute: 'home-prediction-mute',
    predictionCta: 'home-prediction-cta', // «Повторить»
  },
  reels: {
    screen: 'reels-screen',
    item: item('reels-item'),
    video: 'reels-video-live',
    like: 'reels-like',
    dislike: 'reels-dislike',
    primaryCta: 'reels-primary-cta', // «В корзину»
    close: 'reels-close',
  },
  menu: {
    screen: 'menu-screen',
    categoryTab: item('menu-category-tab'),
    dishCard: item('menu-dish-card'),
    dishAdd: item('menu-dish-add'),
  },
  search: {
    screen: 'search-screen',
    input: 'search-input',
    result: item('search-result'),
    didYouMean: 'search-did-you-mean',
    empty: 'search-empty',
  },
  dish: {
    screen: 'dish-screen',
    title: 'dish-title',
    price: 'dish-price',
    option: item('dish-option'),
    removeIngredient: item('dish-remove-ingredient'),
    qtyInc: 'dish-qty-inc',
    qtyDec: 'dish-qty-dec',
    qty: 'dish-qty',
    primaryCta: 'dish-primary-cta', // «В корзину · 590 ₽»
    close: 'dish-close',
  },
  cart: {
    screen: 'cart-screen',
    line: item('cart-line'), // by dish id
    lineInc: item('cart-line-inc'),
    lineDec: item('cart-line-dec'),
    promoInput: 'cart-promo-input',
    promoApply: 'cart-promo-apply',
    promoError: 'cart-promo-error',
    toFreeDelivery: 'cart-to-free-delivery',
    total: 'cart-total',
    groupInvite: 'cart-group-invite',
    groupMember: item('cart-group-member'),
    empty: 'cart-empty',
    primaryCta: 'cart-primary-cta', // «Оформить»
  },
  auth: {
    screen: 'auth-screen',
    phoneInput: 'auth-phone-input',
    codeInput: 'auth-code-input',
    codeError: 'auth-code-error',
    resend: 'auth-resend',
    primaryCta: 'auth-primary-cta', // «Получить код»
  },
  checkout: {
    screen: 'checkout-screen',
    modeDelivery: 'checkout-mode-delivery',
    modePickup: 'checkout-mode-pickup',
    address: 'checkout-address',
    restaurant: item('checkout-restaurant'),
    timeAsap: 'checkout-time-asap',
    payment: item('checkout-payment'), // card | sbp | gpay | cash | card-courier | split
    pointsToggle: 'checkout-points-toggle',
    tips: item('checkout-tips'),
    total: 'checkout-total',
    primaryCta: 'checkout-primary-cta', // «Оплатить 1 990 ₽»
  },
  order: {
    screen: 'order-screen',
    statusTitle: 'order-status-title',
    progress: 'order-progress',
    eta: 'order-eta-live',
    kitchen: 'order-kitchen-live',
    chef: 'order-chef',
    courierMap: 'order-courier-map-live',
    courier: 'order-courier',
    incident: 'order-incident-card',
    incidentResolution: item('order-incident-resolution'), // by resolution id: replace | wait | cancel | retry …
    compensation: 'order-compensation',
    cancel: 'order-cancel',
    pickupArriving: 'order-pickup-arriving', // «Я подхожу»
    pickupShelf: 'order-pickup-shelf',
    rateStar: item('order-rate-star'),
    primaryCta: 'order-primary-cta',
  },
  wheel: {
    screen: 'wheel-screen',
    primaryCta: 'wheel-primary-cta', // «Крутить»
    result: 'wheel-result',
    close: 'wheel-close',
  },
  assistant: {
    screen: 'assistant-screen',
    input: 'assistant-input',
    send: 'assistant-send',
    mic: 'assistant-mic',
    message: item('assistant-message'), // index
    suggestion: item('assistant-suggestion'), // dish id
    chip: item('assistant-chip'),
    primaryCta: 'assistant-primary-cta', // «Добавить всё»
  },
  restaurants: {
    screen: 'restaurants-screen',
    map: 'restaurants-map',
    item: item('restaurants-item'),
  },
  restaurant: {
    screen: 'restaurant-screen',
    book: 'restaurant-primary-cta', // «Забронировать стол»
    banquet: 'restaurant-banquet',
    pickup: 'restaurant-pickup',
  },
  booking: {
    screen: 'booking-screen',
    date: item('booking-date'), // yyyy-mm-dd
    guestsInc: 'booking-guests-inc',
    guestsDec: 'booking-guests-dec',
    floorPlan: 'booking-floor-plan',
    table: item('booking-table'),
    time: item('booking-time'), // "19:00" → booking-time-19-00
    preorderAdd: item('booking-preorder-add'),
    primaryCta: 'booking-primary-cta', // «Забронировать»
    confirmation: 'booking-confirmation',
  },
  banquet: {
    screen: 'banquet-screen',
    guests: 'banquet-guests-slider',
    budget: 'banquet-budget-slider',
    format: item('banquet-format'),
    generate: 'banquet-generate',
    menuItem: item('banquet-menu-item'),
    total: 'banquet-total',
    primaryCta: 'banquet-primary-cta', // «Отправить менеджеру»
    sent: 'banquet-sent',
  },
  profile: {
    screen: 'profile-screen',
    level: 'profile-level',
    progressRing: 'profile-progress-ring',
    points: 'profile-points',
    achievements: 'profile-achievements',
    achievement: item('profile-achievement'),
    history: 'profile-history',
    login: 'profile-login',
    director: 'profile-director',
  },
  director: {
    screen: 'director-screen',
    incident: item('director-incident'), // IncidentKind, e.g. director-incident-kitchen-delay
    speed: item('director-speed'), // multiplier: director-speed-10
    weather: item('director-weather'),
    reset: 'director-reset',
    close: 'director-close',
  },
} as const;
