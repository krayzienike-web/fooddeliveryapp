/**
 * Single source of truth for testIDs used by E2E specs (mirrored in docs/testing.md).
 * Reconciled with `grep -rn "testID=" src` — every id below exists in the app (no placeholders are left;
 * use a `planned: {…}` block for ids agreed before a screen exists — the registry contract test skips it).
 *
 * Convention: kebab-case `screen-element[-qualifier]`.
 *  - `<screen>-screen`         root container of every screen (used to wait for navigation)
 *  - `<screen>-primary-cta`    THE main action of the screen (UX rule: at most one visible at a time)
 *  - `<screen>-<element>-<id>` items of lists. The app uses the entity id VERBATIM (dish/order ids are already
 *                              kebab-case; enum ids keep underscores: `director-incident-kitchen_delay`,
 *                              `checkout-payment-card_courier`). Use `item()`; `kebab()` is for free text (e.g. a booking time label).
 *  - `*-live`                  elements whose content changes over time (timers, maps, video) — masked in screenshots
 *  - shared components derive child ids: Stepper `<id>-inc` / `<id>-dec`, Segmented `<id>-<optionId>`,
 *    Header `<id>-back` (or `header-back` when the Header has no testID).
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

/** `${prefix}-${id}` with the id verbatim — this is what the app does. */
const item = (prefix: string) => (id: string | number) => `${prefix}-${id}`;

export const TID = {
  /** Global chrome, visible on many screens. */
  global: {
    tab: { home: 'tabbar-home', menu: 'tabbar-menu', assistant: 'tabbar-assistant', restaurants: 'tabbar-restaurants', profile: 'tabbar-profile' },
    cartBar: 'cart-bar', // only inside the tab navigator (hidden on the Assistant tab)
    cartBarTotal: 'cart-bar-total',
    cartBarOpen: 'cart-bar-open',
    orderCapsule: 'order-capsule', // hidden on Order, Checkout, Reels, Onboarding, AR, Auth, Dish, Wheel
    orderCapsuleStatus: 'order-capsule-status',
    toast: 'toast',
    back: 'header-back', // Header without its own testID
  },
  /** DishCard widget — shared by home feed, menu and search (scope it to a screen root). */
  dishCard: {
    card: item('dish-card'),
    add: item('dish-add'),
    qty: item('dish-qty'), // Stepper: dish-qty-<id>-inc / -dec, appears after the first add
    qtyInc: (id: string) => `dish-qty-${id}-inc`,
    qtyDec: (id: string) => `dish-qty-${id}-dec`,
    why: item('dish-why'), // «почему подобрали», only when the taste profile is onboarded
  },
  onboarding: {
    screen: 'onboarding-screen',
    like: 'onboarding-option-like', // «Хочу» (swipe right)
    no: 'onboarding-option-no', // «Не моё» (swipe left)
    progress: 'onboarding-progress',
    skip: 'onboarding-skip', // «Сразу в меню» on intro, «Пропустить» in the deck
    primaryCta: 'onboarding-primary-cta', // «Найти мой вкус» on intro, «Поехали» on the radar
  },
  home: {
    screen: 'home-screen',
    logo: 'home-logo', // triple tap → director panel
    mode: 'home-mode',
    modeDelivery: 'home-mode-delivery',
    modePickup: 'home-mode-pickup',
    address: 'home-address',
    search: 'home-search',
    aiEntry: 'home-ai-entry',
    reelsEntry: 'home-reels-entry',
    allMenu: 'home-all-menu',
    forYouList: 'for-you-list', // NB: not prefixed with "home-"
    category: item('home-category'),
    promo: item('home-promo'),
    repeat: item('home-repeat'), // by order id
    activeOrder: 'home-active-order',
    prediction: 'prediction-card', // D2: at most one
    predictionWhy: 'prediction-why',
    predictionMute: 'prediction-mute',
    predictionCta: 'prediction-cta', // «Повторить»
  },
  reels: {
    screen: 'reels-screen',
    // Each rendered reel repeats the ids below (FlatList renders 2–3 items) — use `.first()`.
    like: 'reels-like',
    sound: 'reels-sound',
    ar: 'reels-ar',
    dishCard: 'reels-dish-card',
    dishOpen: 'reels-dish-open',
    add: 'reels-add', // «+» = add to cart from the video
    close: 'reels-close',
    cart: 'reels-cart',
  },
  menu: {
    screen: 'menu-screen',
    search: 'menu-search',
    filters: 'menu-filters',
    filtersSheet: 'menu-filters-sheet',
    filter: item('menu-filter'),
    filtersApply: 'menu-filters-primary-cta',
    tab: item('menu-tab'), // by category id
    section: item('menu-section'),
  },
  search: {
    screen: 'search-screen',
    back: 'search-back',
    input: 'search-input',
    clear: 'search-clear',
    popular: item('search-popular'), // by the visible label, e.g. search-popular-Пепперони
    didYouMean: 'search-did-you-mean',
    askAi: 'search-ask-ai', // «Спросить у Шефа ИИ» (only when nothing is found)
  },
  dish: {
    screen: 'dish-screen',
    title: 'dish-title',
    kbju: 'dish-kbju',
    more: 'dish-more',
    burst: 'dish-burst',
    burstClose: 'dish-burst-close',
    ar: 'dish-ar',
    like: 'dish-like',
    close: 'dish-close',
    group: item('dish-group'), // Segmented modifier group: dish-group-<groupId>-<optionId>
    option: item('dish-option'),
    removeIngredient: item('dish-remove'),
    pair: item('dish-pair'),
    qty: 'dish-qty',
    qtyInc: 'dish-qty-inc',
    qtyDec: 'dish-qty-dec',
    primaryCta: 'dish-primary-cta', // «В корзину · 590 ₽»
  },
  cart: {
    screen: 'cart-screen',
    close: 'cart-close',
    clear: 'cart-clear',
    clearConfirm: 'cart-clear-confirm',
    toFreeDelivery: 'cart-to-free-delivery',
    groupBanner: 'cart-group-banner',
    line: item('cart-line'), // by dish id
    qty: item('cart-qty'),
    lineInc: (dishId: string) => `cart-qty-${dishId}-inc`,
    lineDec: (dishId: string) => `cart-qty-${dishId}-dec`,
    upsell: item('cart-upsell'),
    cutlery: 'cart-cutlery',
    promoRow: 'cart-promo-row',
    promoSheet: 'cart-promo-sheet',
    promoInput: 'cart-promo-input',
    promoApply: 'cart-promo-apply',
    promoRemove: 'cart-promo-remove',
    groupInvite: 'cart-group-invite',
    total: 'cart-total',
    primaryCta: 'cart-primary-cta', // «К оформлению» (empty cart: «Открыть меню»)
  },
  groupCart: {
    screen: 'group-cart-screen',
    back: 'group-cart-header-back',
    split: 'group-split',
    primaryCta: 'group-cart-primary-cta',
  },
  auth: {
    screen: 'auth-screen',
    close: 'auth-close',
    phoneInput: 'auth-phone-input',
    codeInput: 'auth-code-input', // hidden input over 4 boxes; auto-submits on the 4th digit
    codeError: 'auth-code-error',
    resend: 'auth-resend',
    primaryCta: 'auth-primary-cta', // «Получить код»
  },
  checkout: {
    screen: 'checkout-screen',
    back: 'checkout-header-back',
    address: 'checkout-address', // opens the address sheet
    addressOption: item('checkout-address'), // by address id, inside the sheet
    restaurant: item('checkout-restaurant'), // pickup only
    time: 'checkout-time',
    timeAsap: 'checkout-time-asap',
    payment: 'checkout-payment', // opens the payment sheet
    paymentMethod: item('checkout-payment'), // sbp | card | gpay | card_courier | cash
    points: 'checkout-points',
    comment: 'checkout-comment',
    commentInput: 'checkout-comment-input',
    tips: item('checkout-tips'), // 0 | 50 | 100 | 150
    total: 'checkout-total',
    weatherNotice: 'checkout-weather-notice',
    switchPickup: 'checkout-switch-pickup',
    primaryCta: 'checkout-primary-cta', // SlideToPay «Оплатить 1 990 ₽» (tap also works)
  },
  address: {
    screen: 'address-screen',
    back: 'address-back',
    current: 'address-current',
    zone: 'address-zone',
    search: 'address-search',
    suggestion: item('address-suggestion'), // by house
    field: item('address'), // apartment | entrance | intercom | comment
    primaryCta: 'address-primary-cta',
  },
  order: {
    screen: 'order-screen',
    back: 'order-header-back',
    help: 'order-help',
    statusTitle: 'order-status-title',
    eta: 'order-eta-live',
    progress: 'order-progress',
    pickupShelf: 'order-pickup-shelf',
    kitchen: 'order-kitchen-live',
    chef: 'order-chef',
    courierMap: 'order-courier-map-live',
    courier: 'order-courier',
    courierChat: 'order-courier-chat',
    courierCall: 'order-courier-call',
    incident: 'order-incident-card',
    incidentResolution: item('order-incident-resolution'), // by resolution id: wait | cancel | replace …
    pickupArriving: 'order-pickup-arriving', // «Я подхожу» / «Я на месте — выдайте заказ»
    rateStar: item('order-rate-star'), // 1..5, after delivery
    primaryCta: 'order-primary-cta', // «Крутить колесо призов», after delivery
    itemsToggle: 'order-items-toggle',
    support: 'order-support',
  },
  orders: {
    screen: 'orders-screen',
    item: item('orders-item'),
    repeat: item('orders-repeat'),
  },
  rate: {
    screen: 'rate-screen',
    star: item('rate-star'),
    aiPhoto: 'rate-ai-photo',
    solve: 'rate-solve', // ≤ 3 stars
    text: 'rate-text',
    primaryCta: 'rate-primary-cta',
  },
  support: {
    screen: 'support-screen',
    back: 'support-header-back',
    topic: item('support-topic'), // missing | wrong | cold | late | other
    item: item('support-item'), // by dish id
    itemsNext: 'support-items-next',
    refundPoints: 'support-refund-points',
    refundCard: 'support-refund-card',
    human: 'support-human',
    input: 'support-input',
    send: 'support-send',
  },
  assistant: {
    screen: 'assistant-screen',
    mode: 'assistant-mode',
    reset: 'assistant-reset',
    messages: 'assistant-messages',
    starter: item('assistant-starter'), // 0 «Ужин на четверых до 3000 ₽», 1 «Столик на завтра…», 2 «…острое…», 3 «Повтори как обычно»/«Где мой заказ?»
    reply: 'assistant-reply',
    replyText: 'assistant-reply-text',
    thinking: 'assistant-thinking',
    chip: item('assistant-chip'), // index in the LAST reply; prefer matching by text
    input: 'assistant-input',
    voice: 'assistant-voice',
    send: 'assistant-send',
    stop: 'assistant-stop',
    cardDishes: 'assistant-card-dishes',
    dish: item('assistant-dish'),
    addAll: 'assistant-dishes-add-all', // «Добавить всё · 2 980 ₽»
    toCart: 'assistant-dishes-checkout', // after «Добавить всё»: «В корзине · перейти»
    cardBooking: 'assistant-card-booking',
    bookingOpen: 'assistant-booking-open',
    cardBanquet: 'assistant-card-banquet',
    banquetOpen: 'assistant-banquet-open',
    cardOrder: 'assistant-card-order',
    cardSupport: 'assistant-card-support',
    supportOpen: 'assistant-support-open',
  },
  /** Director panel (D0) is a Sheet opened by a triple tap on `home-logo`; there is no close button (tap the backdrop). */
  director: {
    panel: 'director-panel',
    incident: item('director-incident'), // IncidentKind verbatim: director-incident-kitchen_delay
    day: item('director-day'), // 0 = Sunday … 6
    hour: item('director-hour'), // 9 | 13 | 19 | 23
    friday: 'director-friday',
    weather: item('director-weather'), // clear | rain | snow | storm
    near: 'director-near',
    speed: item('director-speed'), // 1 | 2 | 4 | 8
    reset: 'director-reset',
  },

  // ---- placeholders: only `<screen>-screen` exists today; the rest is the agreed contract ----------------
  restaurants: {
    screen: 'restaurants-screen',
    view: 'restaurants-view', // Segmented: restaurants-view-list | restaurants-view-map
    item: item('restaurants-item'), // by restaurant id (list view)
    map: 'restaurants-map',
    mapItem: item('restaurants-map-item'), // card under the map: 1st tap selects, 2nd opens
    banquet: 'restaurants-banquet',
    qr: 'restaurants-qr',
    gift: 'restaurants-gift',
  },
  restaurant: {
    screen: 'restaurant-screen',
    back: 'restaurant-back',
    gallery: 'restaurant-gallery',
    pickup: 'restaurant-pickup', // toast + Menu tab
    banquet: 'restaurant-banquet', // only with a banquet hall
    route: 'restaurant-route',
    call: 'restaurant-call',
    map: 'restaurant-map',
    book: 'restaurant-book', // «Забронировать стол» — the screen's one primary action (not named *-primary-cta)
  },
  booking: {
    screen: 'booking-screen',
    back: 'booking-header-back',
    date: item('booking-date'), // index: 0 = today, 1 = tomorrow …
    guests: 'booking-guests', // Stepper: -inc / -dec; > 12 guests → Banquet
    guestsInc: 'booking-guests-inc',
    guestsDec: 'booking-guests-dec',
    slots: 'booking-slots',
    slot: (hhmm: string) => `booking-slot-${hhmm.replace(':', '')}`, // "19:00" → booking-slot-1900
    floorPlan: 'booking-floor-plan',
    table: item('booking-table'), // by table id, e.g. booking-table-B2; busy/small → aria-disabled
    tableSummary: 'booking-table-summary',
    occasion: item('booking-occasion'),
    preorderToggle: 'booking-preorder-toggle',
    preorderFromCart: 'booking-preorder-from-cart',
    preorder: item('booking-preorder'), // Stepper per dish: booking-preorder-<dishId>-inc
    submit: 'booking-submit', // logged out → Auth → back here
    done: 'booking-done',
    calendar: 'booking-calendar',
    finish: 'booking-finish',
  },
  banquet: {
    screen: 'banquet-screen',
    back: 'banquet-header-back',
    format: 'banquet-format', // Segmented: banquet-format-banquet | -buffet | -catering
    guests: 'banquet-guests', // Slider (role=adjustable; tap on the track jumps)
    budget: 'banquet-budget', // Slider, min = honest minimum for the menu
    date: item('banquet-date'),
    occasion: item('banquet-occasion'),
    hall: item('banquet-hall'), // by restaurant id
    menu: 'banquet-menu',
    reshuffle: 'banquet-reshuffle',
    total: 'banquet-total',
    send: 'banquet-send', // «Отправить менеджеру»
    sent: 'banquet-sent',
    finish: 'banquet-finish',
  },
  qrMenu: {
    screen: 'qr-menu-screen',
    back: 'qr-header-back',
    viewfinder: 'qr-viewfinder',
    demoScan: 'qr-demo-scan',
    callWaiter: 'qr-call-waiter',
    add: item('qr-add'), // order more to the table, by dish id
    splitMode: 'qr-split-mode', // Segmented: qr-split-mode-all | -equal | -items
    people: 'qr-people', // Stepper (equal split)
    bill: 'qr-bill',
    billItem: item('qr-bill-item'), // index; selectable in «Моё»
    tips: item('qr-tips'), // 0 | 5 | 10 | 15 (%)
    pay: 'qr-pay',
    paid: 'qr-paid',
    rate: 'qr-rate',
    finish: 'qr-finish',
  },
  review: {
    fab: 'review-fab',
    panel: 'review-panel',
    pick: 'review-pick',
    screenNote: 'review-screen-note',
    picking: 'review-picking',
    pickScreen: 'review-pick-screen',
    pickCancel: 'review-pick-cancel',
    composer: 'review-composer',
    target: 'review-composer-target',
    kind: item('review-kind'), // change | bug | idea
    text: 'review-text',
    save: 'review-save',
    remove: 'review-delete',
    draft: item('review-draft'), // index in the batch
    empty: 'review-empty',
    send: 'review-send',
    channel: 'review-channel',
    lastSent: 'review-last-sent',
  },
  gift: {
    screen: 'gift-screen',
    back: 'gift-header-back',
    preview: 'gift-preview',
    design: item('gift-design'), // fire | party | thanks
    amount: item('gift-amount'), // 1000 | 2000 | 3000 | 5000
    name: 'gift-name',
    phone: 'gift-phone',
    message: item('gift-message'),
    whenNow: 'gift-when-now',
    when: item('gift-when'),
    send: 'gift-send', // disabled until name + 10-digit phone
    sent: 'gift-sent',
    code: 'gift-code',
    finish: 'gift-finish',
  },
  profile: {
    screen: 'profile-screen',
    login: 'profile-login', // logged out
    settingsGuest: 'profile-settings-guest', // logged out
    loyalty: 'profile-loyalty',
    orders: 'profile-orders',
    bookings: 'profile-bookings',
    bookingsSheet: 'profile-bookings-sheet',
    bookTable: 'profile-book-table',
    favorites: 'profile-favorites',
    favoritesSheet: 'profile-favorites-sheet',
    promos: 'profile-promos',
    gift: 'profile-gift',
    addresses: 'profile-addresses',
    cards: 'profile-cards',
    settings: 'profile-settings',
    help: 'profile-help',
    logout: 'profile-logout',
    logoutSheet: 'profile-logout-sheet',
    logoutConfirm: 'profile-logout-confirm',
  },
  loyalty: {
    screen: 'loyalty-screen',
    back: 'loyalty-header-back',
    login: 'loyalty-login',
    level: 'loyalty-level',
    balance: 'loyalty-balance',
    wheel: 'loyalty-wheel',
    achievements: 'loyalty-achievements',
    history: 'loyalty-history',
  },
  wheel: {
    screen: 'wheel-screen',
    close: 'wheel-close',
    rules: 'wheel-rules',
    rulesSheet: 'wheel-rules-sheet',
    face: 'wheel-face', // flick to spin
    hint: 'wheel-hint',
    spin: 'wheel-spin', // ~3.8 s animation after the API answers
    result: 'wheel-result',
    apply: 'wheel-apply',
    again: 'wheel-again',
    login: 'wheel-login',
  },
  promos: {
    screen: 'promos-screen',
    back: 'promos-header-back',
    item: item('promos-item'), // by promo id; personal ПРИЗ-… promos come first
  },
  promo: {
    screen: 'promo-screen',
    close: 'promo-close',
    code: 'promo-code', // tap = copy
    apply: 'promo-apply',
    applied: 'promo-applied',
  },
  settings: {
    screen: 'settings-screen',
    back: 'settings-header-back',
    theme: 'settings-theme', // Segmented: settings-theme-dark | -light | -system
    haptics: 'settings-haptics',
    diet: item('settings-diet'), // none | pp | veg | gluten_free | halal
    personalization: 'settings-personalization',
    resetTaste: 'settings-reset-taste',
    notif: item('settings-notif'), // status | offers | news
    delete: 'settings-delete',
    deleteSheet: 'settings-delete-sheet',
    deleteNext: 'settings-delete-next',
    deleteConfirm: 'settings-delete-confirm',
    deleteCancel: 'settings-delete-cancel',
  },
  ar: {
    screen: 'ar-screen', // route 'AR' { dishId }: bg-zhar, pz-pepperoni, rl-philadelphia, sal-poke-salmon, des-cheesecake
    back: 'ar-back',
    mode: 'ar-mode', // Segmented: ar-mode-orbit (3D) | ar-mode-table (На столе)
    view: 'ar-view', // GL canvas, drag rotates — mask in screenshots
    size: item('ar-size'), // 25 | 30 | 35 (pizza only)
    explode: 'ar-explode',
    ingredients: 'ar-ingredients',
    part: item('ar-part'), // by index
    tableHint: 'ar-table-hint',
    add: 'ar-add', // «В корзину · N ₽», adds with the chosen size and goes back
  },
} as const;

/** Every literal testID the specs rely on (used by the registry self-check). */
export function literalIds(node: unknown = TID, out: string[] = []): string[] {
  if (typeof node === 'string') out.push(node);
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) if (k !== 'planned') literalIds(v, out);
  return out;
}
